import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { fetchCallsInRange } from "@/lib/calls-query";
import { resolveRange, type RangeKey } from "@/lib/format";
import { RangePicker } from "@/components/range-picker";
import { EmptyState } from "@/components/stat-card";

export const Route = createFileRoute("/_authenticated/analytics")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Analytics · AI Voice Call Manager" },
      { name: "description", content: "Call distribution by AI agent and SIP number across any date range." },
      { property: "og:title", content: "Analytics · AI Voice Call Manager" },
      { property: "og:description", content: "Call distribution by AI agent and SIP number across any date range." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { org } = useOrg();
  const [range, setRange] = useState<RangeKey>("last30");
  const { from, to } = useMemo(() => resolveRange(range), [range]);

  const { data } = useQuery({
    queryKey: ["analytics", org?.id, range],
    enabled: !!org,
    queryFn: async () => {
      const [calls, agents, numbers] = await Promise.all([
        fetchCallsInRange(org!.id, from, to),
        supabase.from("ai_agents").select("id, name").eq("organization_id", org!.id),
        supabase.from("sip_numbers").select("id, number").eq("organization_id", org!.id),
      ]);
      return { calls, agents: agents.data ?? [], numbers: numbers.data ?? [] };
    },
  });

  const byAgent = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of data?.calls ?? []) {
      const name = data?.agents.find((a) => a.id === c.ai_agent_id)?.name ?? "Unassigned";
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return [...map].map(([name, calls]) => ({ name, calls }));
  }, [data]);

  const byNumber = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of data?.calls ?? []) {
      const name = data?.numbers.find((n) => n.id === c.sip_number_id)?.number ?? "Unassigned";
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return [...map].map(([name, calls]) => ({ name, calls }));
  }, [data]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground">Where your call volume is concentrated.</p>
        </div>
        <RangePicker value={range} onChange={setRange} />
      </div>

      {(data?.calls.length ?? 0) === 0 ? (
        <EmptyState title="Nothing to analyse yet" description="Analytics appear as soon as calls are synced into the workspace." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Chart title="Calls by AI agent" rows={byAgent} />
          <Chart title="Calls by SIP number" rows={byNumber} />
        </div>
      )}
    </div>
  );
}

function Chart({ title, rows }: { title: string; rows: Array<{ name: string; calls: number }> }) {
  return (
    <section className="panel p-4">
      <h2 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">{title}</h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={rows} layout="vertical" margin={{ left: 24 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
          <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "var(--color-muted)" }} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
          <Bar dataKey="calls" fill="var(--color-chart-1)" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
