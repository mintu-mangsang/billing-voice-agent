import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";

import { useOrg } from "@/hooks/useOrg";
import { fetchCallsInRange } from "@/lib/calls-query";
import { formatDateTime, formatDuration, formatMoney, resolveRange, type RangeKey } from "@/lib/format";
import { RangePicker } from "@/components/range-picker";
import { StatCard, EmptyState } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/reports")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reports · AI Voice Call Manager" },
      { name: "description", content: "Daily call and cost reports with CSV export for any date range." },
      { property: "og:title", content: "Reports · AI Voice Call Manager" },
      { property: "og:description", content: "Daily call and cost reports with CSV export for any date range." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { org } = useOrg();
  const [range, setRange] = useState<RangeKey>("this_month");
  const { from, to } = useMemo(() => resolveRange(range), [range]);

  const { data: calls = [] } = useQuery({
    queryKey: ["calls", org?.id, range],
    enabled: !!org,
    queryFn: () => fetchCallsInRange(org!.id, from, to),
  });

  const daily = useMemo(() => {
    const map = new Map<string, { day: string; calls: number; minutes: number; ai: number; sip: number; total: number }>();
    for (const c of calls) {
      const day = new Date(c.started_at).toISOString().slice(0, 10);
      const row = map.get(day) ?? { day, calls: 0, minutes: 0, ai: 0, sip: 0, total: 0 };
      row.calls += 1;
      row.minutes += (c.duration_secs ?? 0) / 60;
      row.ai += Number(c.ai_cost ?? 0);
      row.sip += Number(c.sip_cost ?? 0);
      row.total += Number(c.total_cost ?? 0);
      map.set(day, row);
    }
    return [...map.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
  }, [calls]);

  function exportCsv() {
    const header = [
      "started_at",
      "caller",
      "destination",
      "direction",
      "status",
      "duration_secs",
      "billable_secs",
      "ai_cost",
      "sip_cost",
      "total_cost",
      "currency",
    ];
    const rows = calls.map((c) =>
      [
        c.started_at,
        c.caller_number ?? "",
        c.destination_number ?? "",
        c.direction,
        c.status,
        c.duration_secs,
        c.billable_secs,
        c.ai_cost,
        c.sip_cost,
        c.total_cost,
        c.currency,
      ].join(","),
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `call-report-${range}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const totals = calls.reduce(
    (acc, c) => ({
      calls: acc.calls + 1,
      minutes: acc.minutes + (c.duration_secs ?? 0) / 60,
      cost: acc.cost + Number(c.total_cost ?? 0),
    }),
    { calls: 0, minutes: 0, cost: 0 },
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground">Daily call and cost rollups, exportable as CSV.</p>
        </div>
        <div className="flex gap-2">
          <RangePicker value={range} onChange={setRange} />
          <Button variant="outline" onClick={exportCsv} disabled={calls.length === 0}>
            <Download className="mr-2 size-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Calls in period" value={String(totals.calls)} />
        <StatCard label="Talk time" value={formatDuration(totals.minutes * 60)} />
        <StatCard label="Total spend" value={formatMoney(totals.cost)} tone="primary" />
      </div>

      {daily.length === 0 ? (
        <EmptyState title="No report data" description="Reports populate automatically once calls are synced." />
      ) : (
        <div className="panel overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="text-right">Minutes</TableHead>
                <TableHead className="text-right">AI cost</TableHead>
                <TableHead className="text-right">SIP cost</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daily.map((d) => (
                <TableRow key={d.day}>
                  <TableCell>{formatDateTime(`${d.day}T00:00:00Z`).split(",")[0]}</TableCell>
                  <TableCell className="num text-right">{d.calls}</TableCell>
                  <TableCell className="num text-right">{d.minutes.toFixed(1)}</TableCell>
                  <TableCell className="num text-right">{formatMoney(d.ai)}</TableCell>
                  <TableCell className="num text-right">{formatMoney(d.sip)}</TableCell>
                  <TableCell className="num text-right font-medium">{formatMoney(d.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
