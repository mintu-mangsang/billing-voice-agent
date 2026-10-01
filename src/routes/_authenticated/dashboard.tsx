import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock, DollarSign, PhoneCall, PhoneMissed, PhoneOff, Timer, TrendingUp, Zap } from "lucide-react";

import { useOrg } from "@/hooks/useOrg";
import { fetchCallsInRange, type CallRow } from "@/lib/calls-query";
import { formatDuration, formatMoney, resolveRange, type RangeKey } from "@/lib/format";
import { StatCard, EmptyState } from "@/components/stat-card";
import { SyncCdrButton } from "@/components/sync-cdr-button";
import { RangePicker } from "@/components/range-picker";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard · AI Voice Call Manager" },
      { name: "description", content: "Live call volume, talk time and cost analytics for your AI voice operation." },
      { property: "og:title", content: "Dashboard · AI Voice Call Manager" },
      {
        property: "og:description",
        content: "Live call volume, talk time and cost analytics for your AI voice operation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function dayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function DashboardPage() {
  const { org } = useOrg();
  const [range, setRange] = useState<RangeKey>("last7");
  const { from, to } = useMemo(() => resolveRange(range), [range]);

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ["calls", org?.id, range],
    enabled: !!org,
    queryFn: () => fetchCallsInRange(org!.id, from, to),
  });

  const m = useMemo(() => metrics(calls), [calls]);
  const series = useMemo(() => buildSeries(calls, from, to), [calls, from, to]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Call volume, quality and spend across all connected systems.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SyncCdrButton />
          <RangePicker value={range} onChange={setRange} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total calls" value={String(m.total)} icon={PhoneCall} tone="primary" sub={`${m.answered} answered`} />
        <StatCard label="Missed" value={String(m.missed)} icon={PhoneMissed} tone="warning" />
        <StatCard label="Failed" value={String(m.failed)} icon={PhoneOff} tone="destructive" />
        <StatCard label="Successful AI calls" value={String(m.aiSuccess)} icon={Zap} tone="success" />
        <StatCard label="Total talk time" value={formatDuration(m.talkTime)} icon={Clock} />
        <StatCard label="Avg call duration" value={formatDuration(m.avgDuration)} icon={Timer} />
        <StatCard label="Avg billable duration" value={formatDuration(m.avgBillable)} icon={Timer} />
        <StatCard
          label="Total cost"
          value={formatMoney(m.totalCost)}
          
          icon={DollarSign}
          tone="primary"
        />
        <StatCard label="ElevenLabs cost" value={formatMoney(m.aiCost)} icon={DollarSign} />
        <StatCard label="SIP cost" value={formatMoney(m.sipCost)} icon={DollarSign} />
        <StatCard label="Cost per call" value={formatMoney(m.costPerCall)} icon={TrendingUp} />
        <StatCard label="Cost per minute" value={formatMoney(m.costPerMinute)} icon={TrendingUp} />
      </div>

      {calls.length === 0 && !isLoading ? (
        <EmptyState
          title="No call data yet"
          description="Connect an ElevenLabs agent and your Asterisk CDR database under Integrations, then run a sync. Calls will appear here automatically."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Calls per day">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <ChartAxes />
                <Tooltip content={<ChartTip />} />
                <Area dataKey="calls" stroke="var(--color-chart-1)" fill="url(#g1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Talk time per day (minutes)">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={series}>
                <ChartAxes />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="minutes" fill="var(--color-chart-2)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Cost per day">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={series}>
                <ChartAxes />
                <Tooltip content={<ChartTip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line dataKey="aiCost" name="AI" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
                <Line dataKey="sipCost" name="SIP" stroke="var(--color-chart-3)" strokeWidth={2} dot={false} />
                <Line dataKey="totalCost" name="Total" stroke="var(--color-chart-4)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Successful vs failed">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Tooltip content={<ChartTip />} />
                <Pie
                  data={[
                    { name: "Successful", value: m.aiSuccess },
                    { name: "Unsuccessful", value: Math.max(0, m.total - m.aiSuccess) },
                  ]}
                  dataKey="value"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  <Cell fill="var(--color-chart-2)" />
                  <Cell fill="var(--color-chart-5)" />
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </Panel>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel p-4">
      <h2 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function ChartAxes() {
  return (
    <>
      <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
      <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} width={40} />
    </>
  );
}

function ChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="panel px-3 py-2 text-xs">
      <div className="mb-1 font-medium">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="num flex items-center gap-2" style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(2).replace(/\.00$/, "") : p.value}
        </div>
      ))}
    </div>
  );
}

function metrics(calls: CallRow[]) {
  const total = calls.length;
  const answered = calls.filter((c) => c.status === "answered").length;
  const missed = calls.filter((c) => c.status === "missed" || c.status === "no_answer").length;
  const failed = calls.filter((c) => c.status === "failed" || c.status === "congestion").length;
  const aiSuccess = calls.filter((c) => c.call_successful === true).length;
  const talkTime = calls.reduce((s, c) => s + (c.duration_secs ?? 0), 0);
  const billable = calls.reduce((s, c) => s + (c.billable_secs ?? 0), 0);
  const aiCost = calls.reduce((s, c) => s + Number(c.ai_cost ?? 0), 0);
  const sipCost = calls.reduce((s, c) => s + Number(c.sip_cost ?? 0), 0);
  const totalCost = calls.reduce((s, c) => s + Number(c.total_cost ?? 0), 0);
  return {
    total,
    answered,
    missed,
    failed,
    aiSuccess,
    talkTime,
    avgDuration: total ? talkTime / total : 0,
    avgBillable: total ? billable / total : 0,
    aiCost,
    sipCost,
    totalCost,
    costPerCall: total ? totalCost / total : 0,
    costPerMinute: billable ? totalCost / (billable / 60) : 0,
  };
}

function buildSeries(calls: CallRow[], from: Date, to: Date) {
  const buckets = new Map<string, { day: string; calls: number; minutes: number; aiCost: number; sipCost: number; totalCost: number }>();
  const cursor = new Date(from);
  while (cursor <= to) {
    const key = cursor.toISOString().slice(0, 10);
    buckets.set(key, { day: key.slice(5), calls: 0, minutes: 0, aiCost: 0, sipCost: 0, totalCost: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  for (const c of calls) {
    const b = buckets.get(dayKey(c.started_at));
    if (!b) continue;
    b.calls += 1;
    b.minutes += (c.duration_secs ?? 0) / 60;
    b.aiCost += Number(c.ai_cost ?? 0);
    b.sipCost += Number(c.sip_cost ?? 0);
    b.totalCost += Number(c.total_cost ?? 0);
  }
  return [...buckets.values()].map((b) => ({
    ...b,
    minutes: Number(b.minutes.toFixed(1)),
    aiCost: Number(b.aiCost.toFixed(3)),
    sipCost: Number(b.sipCost.toFixed(3)),
    totalCost: Number(b.totalCost.toFixed(3)),
  }));
}
