import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

type TranscriptTurn = { role?: string; message?: string; time_in_call_secs?: number };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env["ELEVENLABS_WEBHOOK_SECRET"];
  if (!secret) return true; // no secret configured -> accept
  if (!signature) return false;
  // ElevenLabs sends "t=<ts>,v0=<hex>"
  const parts = Object.fromEntries(signature.split(",").map((p) => p.split("=")));
  if (!parts.t || !parts.v0) return false;
  const expected = createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v0);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/webhooks/elevenlabs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        if (!verifySignature(rawBody, request.headers.get("elevenlabs-signature"))) {
          return json({ error: "Invalid signature" }, 401);
        }

        let payload: any;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }

        // Post-call payload shape: { type: "post_call_transcription", data: { ... } }
        const data = payload?.data ?? payload;
        const conversationId: string | undefined = data?.conversation_id;
        const agentId: string | undefined = data?.agent_id;
        if (!conversationId) return json({ error: "Missing conversation_id" }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotency: store the raw event, skip if already processed
        const { data: existingEvent } = await supabaseAdmin
          .from("webhook_events")
          .select("id, processed")
          .eq("source", "elevenlabs")
          .eq("external_id", conversationId)
          .maybeSingle();
        if (existingEvent?.processed) return json({ ok: true, duplicate: true });

        let eventId = existingEvent?.id as string | undefined;
        if (!eventId) {
          const { data: ev } = await supabaseAdmin
            .from("webhook_events")
            .insert({ source: "elevenlabs", external_id: conversationId, payload })
            .select("id")
            .single();
          eventId = ev?.id;
        }

        try {
          // Resolve organization + agent from the external agent ID
          let organizationId: string | null = null;
          let aiAgentId: string | null = null;
          if (agentId) {
            const { data: agent } = await supabaseAdmin
              .from("ai_agents")
              .select("id, organization_id")
              .eq("external_agent_id", agentId)
              .maybeSingle();
            if (agent) {
              organizationId = agent.organization_id;
              aiAgentId = agent.id;
            }
          }
          if (!organizationId) {
            // Fall back: single-org installs use the first organization
            const { data: orgs } = await supabaseAdmin.from("organizations").select("id").limit(2);
            if (orgs && orgs.length === 1) organizationId = orgs[0].id;
          }
          if (!organizationId) throw new Error(`No organization found for agent ${agentId ?? "?"}`);

          const durationSecs: number =
            data?.metadata?.call_duration_secs ?? data?.call_duration_secs ?? data?.duration_secs ?? 0;
          const startedAt: string = data?.metadata?.start_time_unix_secs
            ? new Date(data.metadata.start_time_unix_secs * 1000).toISOString()
            : (data?.start_time ?? new Date().toISOString());
          // ElevenLabs reports cost in credits/cents; store as-is in USD
          const cost: number | null =
            data?.metadata?.cost != null ? Number(data.metadata.cost) / 100 : (data?.cost ?? null);
          const callSuccessful: boolean | null =
            data?.analysis?.call_successful === "successful"
              ? true
              : data?.analysis?.call_successful === "unsuccessful"
                ? false
                : null;

          const callRow = {
            organization_id: organizationId,
            ai_agent_id: aiAgentId,
            conversation_id: conversationId,
            external_agent_id: agentId ?? null,
            caller_number: "Web Visitor",
            destination_number: agentId ?? null,
            direction: "inbound",
            status: "answered",
            started_at: startedAt,
            answered_at: startedAt,
            ended_at: new Date(new Date(startedAt).getTime() + durationSecs * 1000).toISOString(),
            duration_secs: durationSecs,
            billable_secs: durationSecs,
            call_successful: callSuccessful,
            correlation_status: "matched",
            correlation_confidence: 1.0,
            provider_reported_cost: cost,
            ai_cost: cost ?? 0,
            sip_cost: 0,
            total_cost: cost ?? 0,
            currency: "USD",
          };

          // Upsert on (organization_id, conversation_id)
          const { data: existing } = await supabaseAdmin
            .from("calls")
            .select("id, sip_cost")
            .eq("organization_id", organizationId)
            .eq("conversation_id", conversationId)
            .maybeSingle();

          let callId: string;
          if (existing) {
            const total = (cost ?? 0) + (existing.sip_cost ?? 0);
            const { data: updated, error } = await supabaseAdmin
              .from("calls")
              .update({ ...callRow, sip_cost: existing.sip_cost, total_cost: total })
              .eq("id", existing.id)
              .select("id")
              .single();
            if (error) throw error;
            callId = updated.id;
          } else {
            const { data: inserted, error } = await supabaseAdmin
              .from("calls")
              .insert(callRow)
              .select("id")
              .single();
            if (error) throw error;
            callId = inserted.id;
          }

          // Transcript turns
          const turns: TranscriptTurn[] = data?.transcript ?? [];
          if (Array.isArray(turns) && turns.length) {
            await supabaseAdmin.from("call_transcripts").delete().eq("call_id", callId);
            const rows = turns
              .filter((t) => t?.message)
              .map((t, i) => ({
                call_id: callId,
                organization_id: organizationId,
                role: t.role === "agent" ? "assistant" : "user",
                message: t.message as string,
                sequence: i,
                spoken_at: new Date(
                  new Date(startedAt).getTime() + (t.time_in_call_secs ?? 0) * 1000,
                ).toISOString(),
              }));
            if (rows.length) await supabaseAdmin.from("call_transcripts").insert(rows);
          }

          // Summary
          const analysis = data?.analysis ?? {};
          if (analysis.transcript_summary || analysis.summary) {
            await supabaseAdmin.from("call_summaries").upsert(
              {
                call_id: callId,
                organization_id: organizationId,
                summary_title: analysis.title ?? analysis.call_summary_title ?? null,
                transcript_summary: analysis.transcript_summary ?? analysis.summary ?? null,
                call_successful: callSuccessful,
                customer_intent: analysis.customer_intent ?? null,
                call_outcome: analysis.call_outcome ?? null,
                next_action: analysis.next_action ?? null,
              },
              { onConflict: "call_id" },
            );
          }

          if (eventId) {
            await supabaseAdmin
              .from("webhook_events")
              .update({ processed: true, organization_id: organizationId })
              .eq("id", eventId);
          }
          return json({ ok: true, callId });
        } catch (err) {
          if (eventId) {
            await supabaseAdmin
              .from("webhook_events")
              .update({ error_message: String(err).slice(0, 500) })
              .eq("id", eventId);
          }
          console.error("elevenlabs webhook error:", err);
          return json({ error: "Processing failed" }, 500);
        }
      },
    },
  },
});
