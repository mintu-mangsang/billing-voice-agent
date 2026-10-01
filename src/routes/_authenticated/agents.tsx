import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { EmptyState } from "@/components/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/agents")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "AI agents · AI Voice Call Manager" },
      { name: "description", content: "Every connected ElevenLabs conversational agent and its call volume." },
      { property: "og:title", content: "AI agents · AI Voice Call Manager" },
      { property: "og:description", content: "Every connected ElevenLabs conversational agent and its call volume." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AgentsPage,
});

function AgentsPage() {
  const { org } = useOrg();
  const { data } = useQuery({
    queryKey: ["agents", org?.id],
    enabled: !!org,
    queryFn: async () => {
      const [agents, calls] = await Promise.all([
        supabase.from("ai_agents").select("*").eq("organization_id", org!.id).order("name"),
        supabase.from("calls").select("ai_agent_id, duration_secs, ai_cost").eq("organization_id", org!.id),
      ]);
      return { agents: agents.data ?? [], calls: calls.data ?? [] };
    },
  });

  const agents = data?.agents ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">AI agents</h1>
        <p className="text-sm text-muted-foreground">Agents imported from your connected ElevenLabs account.</p>
      </div>

      {agents.length === 0 ? (
        <EmptyState
          title="No agents imported"
          description="Add your ElevenLabs API key under Integrations and run the connection test to import your agents."
        />
      ) : (
        <div className="panel overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Agent ID</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="text-right">Talk time (min)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((a) => {
                const rows = (data?.calls ?? []).filter((c) => c.ai_agent_id === a.id);
                const minutes = rows.reduce((s, c) => s + (c.duration_secs ?? 0), 0) / 60;
                return (
                  <TableRow key={a.id}>
                    <TableCell>{a.name}</TableCell>
                    <TableCell className="num text-xs text-muted-foreground">{a.external_agent_id}</TableCell>
                    <TableCell className="num text-right">{rows.length}</TableCell>
                    <TableCell className="num text-right">{minutes.toFixed(1)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={a.enabled ? "border-success/40 bg-success/10 text-success" : ""}>
                        {a.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
