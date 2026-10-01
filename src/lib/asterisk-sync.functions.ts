import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type CdrRow = Record<string, unknown>;

function mapStatus(disposition: string) {
  const d = disposition.toUpperCase();
  if (d === "ANSWERED") return "answered";
  if (d === "NO ANSWER") return "no_answer";
  if (d === "BUSY") return "busy";
  if (d === "FAILED") return "failed";
  if (d === "CONGESTION") return "congestion";
  return "unknown";
}

function toIso(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v).replace(" ", "T"));
  return isNaN(d.getTime()) || d.getFullYear() < 1971 ? null : d.toISOString();
}

type Provider = {
  id: string;
  incoming_rate: number;
  outgoing_rate: number;
  billing_increment: number;
  minimum_duration: number;
};

function sipCost(billsec: number, rate: number, p: Provider | null) {
  if (billsec <= 0 || !rate) return 0;
  const inc = Math.max(1, Number(p?.billing_increment ?? 1));
  let billed = Math.ceil(billsec / inc) * inc;
  billed = Math.max(billed, Number(p?.minimum_duration ?? 0));
  return Number(((billed / 60) * rate).toFixed(4));
}

/** Pull CDR records from the Asterisk MariaDB/MySQL cdr table into calls. */
export const syncAsteriskCdr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid(), full: z.boolean().default(false) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", data.organizationId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member || !["super_admin", "admin", "manager"].includes(member.role)) {
      throw new Error("You do not have permission to sync calls for this workspace.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const orgId = data.organizationId;

    const { data: instances } = await supabaseAdmin
      .from("asterisk_instances")
      .select("*")
      .eq("organization_id", orgId)
      .eq("enabled", true);
    if (!instances?.length) {
      return { ok: false, message: "No Asterisk / PBX is configured. Add it under Integrations.", imported: 0, updated: 0 };
    }

    const [{ data: providers }, { data: numbers }] = await Promise.all([
      supabaseAdmin.from("sip_providers").select("*").eq("organization_id", orgId).eq("enabled", true),
      supabaseAdmin.from("sip_numbers").select("*").eq("organization_id", orgId),
    ]);
    const provById = new Map((providers ?? []).map((p) => [p.id, p as unknown as Provider]));
    const defaultProv = (providers?.[0] as unknown as Provider) ?? null;
    const digits = (s: string) => s.replace(/\D/g, "").slice(-10);
    const numByKey = new Map((numbers ?? []).map((n) => [digits(n.number), n]));

    const mysql = await import("mysql2/promise");
    let imported = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const inst of instances) {
      const { data: job } = await supabaseAdmin
        .from("sync_jobs")
        .insert({ organization_id: orgId, job_type: "asterisk_cdr", status: "running" })
        .select("id")
        .single();
      let processed = 0;
      try {
        const { data: secret } = await supabaseAdmin
          .from("api_credentials")
          .select("secret_value")
          .eq("owner_type", "asterisk_instance")
          .eq("owner_id", inst.id)
          .eq("key_name", "CDR_DB_PASSWORD")
          .maybeSingle();
        if (!inst.cdr_db_host || !inst.cdr_db_user || !inst.cdr_db_name) {
          throw new Error("CDR database host, name or user is missing.");
        }
        const conn = await mysql.createConnection({
          host: inst.cdr_db_host,
          port: inst.cdr_db_port && inst.cdr_db_port !== 5432 ? inst.cdr_db_port : 3306,
          user: inst.cdr_db_user,
          password: secret?.secret_value ?? "",
          database: inst.cdr_db_name,
          connectTimeout: 15000,
          disableEval: true,
        } as any);
        let rows: CdrRow[] = [];
        try {
          const [cols] = await conn.query("SHOW COLUMNS FROM cdr");
          const names = (cols as Array<{ Field: string }>).map((c) => c.Field);
          const timeCol = names.includes("start") ? "start" : names.includes("calldate") ? "calldate" : null;
          if (!timeCol) throw new Error("cdr table has no 'start' or 'calldate' column.");

          let since: string | null = null;
          if (!data.full) {
            const { data: last } = await supabaseAdmin
              .from("calls")
              .select("started_at")
              .eq("asterisk_instance_id", inst.id)
              .order("started_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (last?.started_at) since = new Date(new Date(last.started_at).getTime() - 86400000).toISOString().slice(0, 19).replace("T", " ");
          }
          const [r] = since
            ? await conn.query(`SELECT * FROM cdr WHERE \`${timeCol}\` >= ? ORDER BY \`${timeCol}\` DESC LIMIT 5000`, [since])
            : await conn.query(`SELECT * FROM cdr ORDER BY \`${timeCol}\` DESC LIMIT 5000`);
          rows = (r as CdrRow[]).map((x) => ({ ...x, __time: x[timeCol] }));
        } finally {
          await conn.end().catch(() => {});
        }

        const mapped = rows
          .map((c) => {
            const uniqueid = String(c["uniqueid"] ?? "").trim();
            const started = toIso(c["__time"]);
            if (!uniqueid || !started) return null;
            const src = String(c["src"] ?? "") || null;
            const dst = String(c["dst"] ?? "") || null;
            const billsec = Number(c["billsec"] ?? 0) || 0;
            const inNum = dst ? numByKey.get(digits(dst)) : undefined;
            const outNum = !inNum && src ? numByKey.get(digits(src)) : undefined;
            const num = inNum ?? outNum;
            const direction = inNum ? "inbound" : outNum ? "outbound" : "unknown";
            const prov = (num?.sip_provider_id && provById.get(num.sip_provider_id)) || defaultProv;
            const rate = Number(direction === "inbound" ? prov?.incoming_rate : prov?.outgoing_rate) || 0;
            const sip = sipCost(billsec, rate, prov);
            return {
              organization_id: orgId,
              asterisk_instance_id: inst.id,
              asterisk_uniqueid: uniqueid,
              asterisk_linkedid: c["linkedid"] ? String(c["linkedid"]) : null,
              caller_number: src,
              destination_number: dst,
              direction,
              status: mapStatus(String(c["disposition"] ?? "")),
              disposition: c["disposition"] ? String(c["disposition"]) : null,
              started_at: started,
              answered_at: toIso(c["answer"]),
              ended_at: toIso(c["end"]),
              duration_secs: billsec,
              billable_secs: billsec,
              sip_number_id: num?.id ?? null,
              sip_provider_id: prov?.id ?? null,
              sip_cost: sip,
              currency: "BDT",
            };
          })
          .filter((m): m is NonNullable<typeof m> => m !== null);

        // De-duplicate within batch (keep the longest billsec per uniqueid)
        const byId = new Map<string, (typeof mapped)[number]>();
        for (const m of mapped) {
          const prev = byId.get(m.asterisk_uniqueid);
          if (!prev || m.billable_secs > prev.billable_secs) byId.set(m.asterisk_uniqueid, m);
        }
        const all = [...byId.values()];

        for (let i = 0; i < all.length; i += 500) {
          const chunk = all.slice(i, i + 500);
          const { data: existing } = await supabaseAdmin
            .from("calls")
            .select("id, asterisk_uniqueid, ai_cost")
            .eq("organization_id", orgId)
            .in("asterisk_uniqueid", chunk.map((c) => c.asterisk_uniqueid));
          const ex = new Map((existing ?? []).map((e) => [e.asterisk_uniqueid, e]));
          const toInsert = chunk
            .filter((c) => !ex.has(c.asterisk_uniqueid))
            .map((c) => ({ ...c, ai_cost: 0, total_cost: c.sip_cost, correlation_status: "pending" }));
          if (toInsert.length) {
            const { error } = await supabaseAdmin.from("calls").insert(toInsert as any);
            if (error) throw new Error(error.message);
            imported += toInsert.length;
          }
          for (const c of chunk.filter((c) => ex.has(c.asterisk_uniqueid))) {
            const e = ex.get(c.asterisk_uniqueid)!;
            const { error } = await supabaseAdmin
              .from("calls")
              .update({ ...c, total_cost: Number((c.sip_cost + Number(e.ai_cost ?? 0)).toFixed(4)) } as any)
              .eq("id", e.id);
            if (error) throw new Error(error.message);
            updated += 1;
          }
          processed += chunk.length;
        }

        await supabaseAdmin
          .from("asterisk_instances")
          .update({ connection_status: "connected", last_error: null, last_sync_at: new Date().toISOString() })
          .eq("id", inst.id);
        if (job) {
          await supabaseAdmin
            .from("sync_jobs")
            .update({ status: "completed", records_processed: processed, finished_at: new Date().toISOString() })
            .eq("id", job.id);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${inst.name}: ${msg}`);
        await supabaseAdmin
          .from("asterisk_instances")
          .update({ connection_status: "error", last_error: msg })
          .eq("id", inst.id);
        if (job) {
          await supabaseAdmin
            .from("sync_jobs")
            .update({ status: "failed", error_message: msg, records_processed: processed, finished_at: new Date().toISOString() })
            .eq("id", job.id);
        }
      }
    }

    return {
      ok: errors.length === 0,
      message: errors.length ? errors.join(" | ") : `Synced: ${imported} new, ${updated} updated.`,
      imported,
      updated,
    };
  });
