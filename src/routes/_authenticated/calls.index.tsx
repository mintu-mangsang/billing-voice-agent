import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { useOrg } from "@/hooks/useOrg";
import { fetchCallsInRange, type CallRow } from "@/lib/calls-query";
import { formatDateTime, formatDuration, formatMoney, resolveRange, type RangeKey } from "@/lib/format";
import { SyncCdrButton } from "@/components/sync-cdr-button";
import { RangePicker } from "@/components/range-picker";
import { EmptyState } from "@/components/stat-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/calls/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Call history · AI Voice Call Manager" },
      { name: "description", content: "Search, filter and inspect every AI voice call with duration and cost detail." },
      { property: "og:title", content: "Call history · AI Voice Call Manager" },
      {
        property: "og:description",
        content: "Search, filter and inspect every AI voice call with duration and cost detail.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CallsPage,
});

const PAGE_SIZE = 25;

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "answered"
      ? "border-success/40 bg-success/10 text-success"
      : status === "failed" || status === "congestion"
        ? "border-destructive/40 bg-destructive/10 text-destructive"
        : status === "missed" || status === "no_answer" || status === "busy"
          ? "border-warning/40 bg-warning/10 text-warning"
          : "border-border bg-muted text-muted-foreground";
  return <Badge variant="outline" className={`capitalize ${tone}`}>{status.replace("_", " ")}</Badge>;
}

function CallsPage() {
  const { org } = useOrg();
  const [range, setRange] = useState<RangeKey>("last30");
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState("all");
  const [status, setStatus] = useState("all");
  const [minDuration, setMinDuration] = useState("");
  const [maxDuration, setMaxDuration] = useState("");
  const [page, setPage] = useState(0);
  const { from, to } = useMemo(() => resolveRange(range), [range]);

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ["calls", org?.id, range],
    enabled: !!org,
    queryFn: () => fetchCallsInRange(org!.id, from, to),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return calls.filter((c: CallRow) => {
      if (direction !== "all" && c.direction !== direction) return false;
      if (status !== "all" && c.status !== status) return false;
      if (minDuration && c.duration_secs < Number(minDuration)) return false;
      if (maxDuration && c.duration_secs > Number(maxDuration)) return false;
      if (!q) return true;
      return [
        c.caller_number,
        c.destination_number,
        c.conversation_id,
        c.asterisk_uniqueid,
        c.asterisk_linkedid,
        c.external_agent_id,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [calls, search, direction, status, minDuration, maxDuration]);

  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Call history</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} calls in the selected period.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SyncCdrButton />
          <RangePicker value={range} onChange={setRange} />
        </div>
      </div>

      <div className="panel flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search caller, conversation ID, unique ID, agent ID…"
            className="pl-9"
          />
        </div>
        <Select value={direction} onValueChange={setDirection}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Direction" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All directions</SelectItem>
            <SelectItem value="inbound">Inbound</SelectItem>
            <SelectItem value="outbound">Outbound</SelectItem>
            <SelectItem value="internal">Internal</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="answered">Answered</SelectItem>
            <SelectItem value="missed">Missed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="busy">Busy</SelectItem>
            <SelectItem value="no_answer">No answer</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={minDuration}
          onChange={(e) => setMinDuration(e.target.value)}
          placeholder="Min sec"
          className="w-24"
          inputMode="numeric"
        />
        <Input
          value={maxDuration}
          onChange={(e) => setMaxDuration(e.target.value)}
          placeholder="Max sec"
          className="w-24"
          inputMode="numeric"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={isLoading ? "Loading calls…" : "No calls match these filters"}
          description="Once ElevenLabs conversations and Asterisk CDR records are synced, every call appears here with duration, transcript and cost."
        />
      ) : (
        <div className="panel overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date / time</TableHead>
                <TableHead>Caller</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead className="text-right">Billable</TableHead>
                <TableHead className="text-right">AI cost</TableHead>
                <TableHead className="text-right">SIP cost</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((c) => (
                <TableRow key={c.id} className="cursor-pointer">
                  <TableCell className="whitespace-nowrap">
                    <Link to="/calls/$callId" params={{ callId: c.id }} className="hover:text-primary">
                      {formatDateTime(c.started_at)}
                    </Link>
                  </TableCell>
                  <TableCell className="num">{c.caller_number ?? "—"}</TableCell>
                  <TableCell className="num">{c.destination_number ?? "—"}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{c.direction}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="num text-right">{formatDuration(c.duration_secs)}</TableCell>
                  <TableCell className="num text-right">{formatDuration(c.billable_secs)}</TableCell>
                  <TableCell className="num text-right">{formatMoney(c.ai_cost, c.currency)}</TableCell>
                  <TableCell className="num text-right">{formatMoney(c.sip_cost, c.currency)}</TableCell>
                  <TableCell className="num text-right font-medium">{formatMoney(c.total_cost, c.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>
              Page {page + 1} of {pages}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
