import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

async function assertManager(context: { supabase: any; userId: string }, orgId: string) {
  const { data, error } = await context.supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error || !data || !["super_admin", "admin"].includes(data.role)) {
    throw new Error("You do not have permission to change this workspace's integrations.");
  }
}

async function storeSecret(ownerType: string, ownerId: string, orgId: string, keyName: string, value: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("api_credentials").upsert(
    { owner_type: ownerType, owner_id: ownerId, organization_id: orgId, key_name: keyName, secret_value: value },
    { onConflict: "owner_type,owner_id,key_name" },
  );
  if (error) throw new Error(error.message);
}

async function readSecret(ownerType: string, ownerId: string, keyName: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("api_credentials")
    .select("secret_value")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .eq("key_name", keyName)
    .maybeSingle();
  return data?.secret_value ?? null;
}

/** Create or update an ElevenLabs provider and store its API key server-side. */
export const saveElevenLabsProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        providerId: z.string().uuid().optional(),
        name: z.string().min(1).max(80),
        apiKey: z.string().min(10).optional(),
        agentId: z.string().trim().max(120).optional(),
        enabled: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context, data.organizationId);

    let providerId = data.providerId;
    if (providerId) {
      const { error } = await context.supabase
        .from("ai_providers")
        .update({ name: data.name, enabled: data.enabled })
        .eq("id", providerId);
      if (error) throw new Error(error.message);
    } else {
      const { data: created, error } = await context.supabase
        .from("ai_providers")
        .insert({
          organization_id: data.organizationId,
          name: data.name,
          provider_type: "elevenlabs",
          enabled: data.enabled,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      providerId = created.id as string;
    }

    if (data.apiKey) {
      await storeSecret("ai_provider", providerId!, data.organizationId, "ELEVENLABS_API_KEY", data.apiKey);
    }

    let agentName: string | null = null;
    if (data.agentId) {
      const apiKey = data.apiKey ?? (await readSecret("ai_provider", providerId!, "ELEVENLABS_API_KEY"));
      if (apiKey) {
        const res = await fetch(`${ELEVENLABS_BASE}/convai/agents/${encodeURIComponent(data.agentId)}`, {
          headers: { "xi-api-key": apiKey },
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Provider saved, but ElevenLabs could not find agent "${data.agentId}" (${res.status}): ${body.slice(0, 200)}`);
        }
        const agent = (await res.json()) as { name?: string };
        agentName = agent.name ?? null;
      }
      const { error } = await context.supabase.from("ai_agents").upsert(
        {
          organization_id: data.organizationId,
          ai_provider_id: providerId,
          external_agent_id: data.agentId,
          name: agentName ?? data.agentId,
        },
        { onConflict: "organization_id,external_agent_id" },
      );
      if (error) throw new Error(error.message);
    }

    return { providerId, hasKey: !!data.apiKey, agentName };
  });

/** Verify the stored ElevenLabs key and import the account's agents. */
export const testElevenLabsConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid(), providerId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context, data.organizationId);

    const apiKey = await readSecret("ai_provider", data.providerId, "ELEVENLABS_API_KEY");
    if (!apiKey) return { ok: false, message: "No API key saved for this provider yet." };

    const res = await fetch(`${ELEVENLABS_BASE}/convai/agents?page_size=30`, {
      headers: { "xi-api-key": apiKey },
    });
    const body = await res.text();

    if (!res.ok) {
      await context.supabase
        .from("ai_providers")
        .update({ connection_status: "error", last_error: `${res.status}: ${body.slice(0, 300)}` })
        .eq("id", data.providerId);
      return { ok: false, message: `ElevenLabs rejected the key (${res.status}).`, agents: 0 };
    }

    let agents: Array<{ agent_id: string; name?: string }> = [];
    try {
      const parsed = JSON.parse(body) as { agents?: Array<{ agent_id: string; name?: string }> };
      agents = parsed.agents ?? [];
    } catch {
      agents = [];
    }

    for (const agent of agents) {
      await context.supabase.from("ai_agents").upsert(
        {
          organization_id: data.organizationId,
          ai_provider_id: data.providerId,
          external_agent_id: agent.agent_id,
          name: agent.name ?? agent.agent_id,
        },
        { onConflict: "organization_id,external_agent_id" },
      );
    }

    await context.supabase
      .from("ai_providers")
      .update({ connection_status: "connected", last_error: null })
      .eq("id", data.providerId);

    return { ok: true, message: `Connected. ${agents.length} agent(s) available.`, agents: agents.length };
  });

/** Create or update an Asterisk PBX instance and store AMI / CDR passwords server-side. */
export const saveAsteriskInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        instanceId: z.string().uuid().optional(),
        name: z.string().min(1).max(80),
        asterisk_host: z.string().max(255).optional(),
        ami_host: z.string().max(255).optional(),
        ami_port: z.number().int().min(1).max(65535).default(5038),
        ami_username: z.string().max(120).optional(),
        ami_password: z.string().max(400).optional(),
        cdr_db_host: z.string().max(255).optional(),
        cdr_db_port: z.number().int().min(1).max(65535).default(5432),
        cdr_db_name: z.string().max(120).optional(),
        cdr_db_user: z.string().max(120).optional(),
        cdr_db_password: z.string().max(400).optional(),
        recording_path: z.string().max(400).optional(),
        enabled: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context, data.organizationId);

    const row = {
      organization_id: data.organizationId,
      name: data.name,
      asterisk_host: data.asterisk_host ?? null,
      ami_host: data.ami_host ?? null,
      ami_port: data.ami_port,
      ami_username: data.ami_username ?? null,
      cdr_db_host: data.cdr_db_host ?? null,
      cdr_db_port: data.cdr_db_port,
      cdr_db_name: data.cdr_db_name ?? null,
      cdr_db_user: data.cdr_db_user ?? null,
      recording_path: data.recording_path ?? null,
      enabled: data.enabled,
    };

    let instanceId = data.instanceId;
    if (instanceId) {
      const { error } = await context.supabase.from("asterisk_instances").update(row).eq("id", instanceId);
      if (error) throw new Error(error.message);
    } else {
      const { data: created, error } = await context.supabase
        .from("asterisk_instances")
        .insert(row)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      instanceId = created.id as string;
    }

    if (data.ami_password) {
      await storeSecret("asterisk_instance", instanceId!, data.organizationId, "AMI_PASSWORD", data.ami_password);
    }
    if (data.cdr_db_password) {
      await storeSecret("asterisk_instance", instanceId!, data.organizationId, "CDR_DB_PASSWORD", data.cdr_db_password);
    }

    return { instanceId };
  });

/** Report whether credentials needed for CDR access are present. */
export const checkAsteriskCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid(), instanceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context, data.organizationId);
    const cdr = await readSecret("asterisk_instance", data.instanceId, "CDR_DB_PASSWORD");
    const ami = await readSecret("asterisk_instance", data.instanceId, "AMI_PASSWORD");
    const status = cdr ? "configured" : "incomplete";
    await context.supabase
      .from("asterisk_instances")
      .update({
        connection_status: status,
        last_error: cdr ? null : "CDR database password missing.",
      })
      .eq("id", data.instanceId);
    return {
      ok: !!cdr,
      amiPasswordSaved: !!ami,
      cdrPasswordSaved: !!cdr,
    };
  });
