import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { formatDateTime, formatDuration, formatMoney } from "@/lib/format";
import { EmptyState } from "@/components/stat-card";
import { StatusBadge } from "./calls.index";

export const Route = createFileRoute("/_authenticated/calls/$callId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Call detail · AI Voice Call Manager" },
      { name: "description", content: "Full transcript, AI summary, recording and cost breakdown for a single call." },
      { property: "og:title", content: "Call detail · AI Voice Call Manager" },
      {
        property: "og:description",
        content: "Full transcript, AI summary, recording and cost breakdown for a single call.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CallDetailPage,
});

function CallDetailPage() {
  const { callId } = useParams({ from: "/_authenticated/calls/$callId" });
  const { org } = useOrg();

  const { data, isLoading } = useQuery({
    queryKey: ["call", callId],
    queryFn: async () => {
      const [call, transcript, summary, recordings] = await Promise.all([
        supabase.from("calls").select("*").eq("id", callId).maybeSingle(),
        supabase.from("call_transcripts").select("*").eq("call_id", callId).order("sequence"),
        supabase.from("call_summaries").select("*").eq("call_id", callId).maybeSingle(),
        supabase.from("call_recordings").select("*").eq("call_id", callId),
      ]);
      return {
        call: call.data,
        transcript: transcript.data ?? [],
        summary: summary.data,
        recordings: recordings.data ?? [],
      };
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading call…</p>;
  if (!data?.call) {
    return <EmptyState title="Call not found" description="This call may have been removed or belongs to another workspace." />;
  }

  const c = data.call;

  return (
    <div className="space-y-5">
      <Link to="/calls" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to call history
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="num text-xl font-semibold">
          {c.caller_number ?? "Unknown"} → {c.destination_number ?? "Unknown"}
        </h1>
        <StatusBadge status={c.status} />
        <span className="text-sm text-muted-foreground">{formatDateTime(c.started_at)}</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="panel space-y-3 p-4">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Call information</h2>
          <Field label="Call ID" value={c.id} mono />
          <Field label="Asterisk unique ID" value={c.asterisk_uniqueid} mono />
          <Field label="Asterisk linked ID" value={c.asterisk_linkedid} mono />
          <Field label="Conversation ID" value={c.conversation_id} mono />
          <Field label="Agent ID" value={c.external_agent_id} mono />
          <Field label="Direction" value={c.direction} />
          <Field label="Disposition" value={c.disposition} />
          <Field label="Correlation" value={c.correlation_status} />
          <Field label="Start" value={formatDateTime(c.started_at)} />
          <Field label="Answer" value={formatDateTime(c.answered_at)} />
          <Field label="End" value={formatDateTime(c.ended_at)} />
          <Field label="Duration" value={formatDuration(c.duration_secs)} />
          <Field label="Billable duration" value={formatDuration(c.billable_secs)} />
        </section>

        <section className="panel space-y-3 p-4">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Cost breakdown</h2>
          <Field label="Provider reported" value={c.provider_reported_cost != null ? formatMoney(c.provider_reported_cost, c.currency) : null} />
          <Field label="AI cost" value={formatMoney(c.ai_cost, c.currency)} />
          <Field label="SIP cost" value={formatMoney(c.sip_cost, c.currency)} />
          <Field label="Total cost" value={formatMoney(c.total_cost, c.currency)} />
          <Field label="AI call successful" value={c.call_successful == null ? null : c.call_successful ? "Yes" : "No"} />

          <h2 className="pt-3 text-xs uppercase tracking-wider text-muted-foreground">Recordings</h2>
          {data.recordings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recording available for this call.</p>
          ) : (
            data.recordings.map((r) => (
              <div key={r.id} className="space-y-1">
                <p className="text-xs capitalize text-muted-foreground">{r.provider} recording</p>
                {r.recording_url ? (
                  <audio controls src={r.recording_url} className="w-full" />
                ) : (
                  <p className="text-sm text-muted-foreground">Recording stored on the PBX.</p>
                )}
              </div>
            ))
          )}
        </section>

        <section className="panel space-y-3 p-4">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">AI summary</h2>
          {data.summary ? (
            <>
              <p className="font-medium">{data.summary.summary_title ?? "Summary"}</p>
              <p className="text-sm text-muted-foreground">{data.summary.transcript_summary ?? "—"}</p>
              <Field label="Customer intent" value={data.summary.customer_intent} />
              <Field label="Outcome" value={data.summary.call_outcome} />
              <Field label="Next action" value={data.summary.next_action} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No summary received from the AI provider yet.</p>
          )}
        </section>
      </div>

      <section className="panel p-4">
        <h2 className="mb-4 text-xs uppercase tracking-wider text-muted-foreground">Transcript</h2>
        {data.transcript.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transcript stored for this call.</p>
        ) : (
          <div className="space-y-3">
            {data.transcript.map((t) => {
              const isAgent = t.role === "assistant";
              return (
                <div key={t.id} className={isAgent ? "flex justify-start" : "flex justify-end"}>
                  <div
                    className={[
                      "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                      isAgent ? "bg-secondary text-secondary-foreground" : "bg-primary/15 text-foreground",
                    ].join(" ")}
                  >
                    <div className="mb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {isAgent ? "AI agent" : t.role === "user" ? "Customer" : t.role}
                    </div>
                    {t.message}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right ${mono ? "num text-xs" : ""}`}>{value || "—"}</span>
    </div>
  );
}
