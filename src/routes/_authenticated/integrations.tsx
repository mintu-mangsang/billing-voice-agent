import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plug, Server } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import {
  saveAsteriskInstance,
  saveElevenLabsProvider,
  testElevenLabsConnection,
  checkAsteriskCredentials,
} from "@/lib/integrations.functions";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/integrations")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Integrations · AI Voice Call Manager" },
      { name: "description", content: "Connect ElevenLabs agents and Asterisk PBX systems with secure server-side credentials." },
      { property: "og:title", content: "Integrations · AI Voice Call Manager" },
      {
        property: "og:description",
        content: "Connect ElevenLabs agents and Asterisk PBX systems with secure server-side credentials.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IntegrationsPage,
});

function StatusChip({ status }: { status: string }) {
  const tone =
    status === "connected" || status === "configured"
      ? "border-success/40 bg-success/10 text-success"
      : status === "error" || status === "incomplete"
        ? "border-destructive/40 bg-destructive/10 text-destructive"
        : "border-border bg-muted text-muted-foreground";
  return <Badge variant="outline" className={`capitalize ${tone}`}>{status}</Badge>;
}

function IntegrationsPage() {
  const { org, canManage } = useOrg();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["integrations", org?.id],
    enabled: !!org,
    queryFn: async () => {
      const [providers, agents, instances] = await Promise.all([
        supabase.from("ai_providers").select("*").eq("organization_id", org!.id).order("created_at"),
        supabase.from("ai_agents").select("*").eq("organization_id", org!.id).order("name"),
        supabase.from("asterisk_instances").select("*").eq("organization_id", org!.id).order("created_at"),
      ]);
      return {
        providers: providers.data ?? [],
        agents: agents.data ?? [],
        instances: instances.data ?? [],
      };
    },
  });

  const saveProvider = useServerFn(saveElevenLabsProvider);
  const testProvider = useServerFn(testElevenLabsConnection);
  const saveAsterisk = useServerFn(saveAsteriskInstance);
  const checkAsterisk = useServerFn(checkAsteriskCredentials);

  const provider = data?.providers[0];
  const instance = data?.instances[0];

  const [busy, setBusy] = useState(false);
  const [elName, setElName] = useState("");
  const [elKey, setElKey] = useState("");
  const [ast, setAst] = useState<Record<string, string>>({});
  const [astEnabled, setAstEnabled] = useState(true);

  const reload = () => qc.invalidateQueries({ queryKey: ["integrations", org?.id] });

  async function onSaveElevenLabs() {
    if (!org) return;
    setBusy(true);
    try {
      const res = await saveProvider({
        data: {
          organizationId: org.id,
          providerId: provider?.id,
          name: elName || provider?.name || "ElevenLabs",
          apiKey: elKey || undefined,
          enabled: true,
        },
      });
      setElKey("");
      toast.success(res.hasKey ? "Saved. API key stored securely on the server." : "Provider saved.");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the provider.");
    } finally {
      setBusy(false);
    }
  }

  async function onTestElevenLabs() {
    if (!org || !provider) return;
    setBusy(true);
    try {
      const res = await testProvider({ data: { organizationId: org.id, providerId: provider.id } });
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connection test failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveAsterisk() {
    if (!org) return;
    setBusy(true);
    try {
      await saveAsterisk({
        data: {
          organizationId: org.id,
          instanceId: instance?.id,
          name: ast.name || instance?.name || "Primary PBX",
          asterisk_host: ast.asterisk_host ?? instance?.asterisk_host ?? undefined,
          ami_host: ast.ami_host ?? instance?.ami_host ?? undefined,
          ami_port: Number(ast.ami_port ?? instance?.ami_port ?? 5038),
          ami_username: ast.ami_username ?? instance?.ami_username ?? undefined,
          ami_password: ast.ami_password || undefined,
          cdr_db_host: ast.cdr_db_host ?? instance?.cdr_db_host ?? undefined,
          cdr_db_port: Number(ast.cdr_db_port ?? instance?.cdr_db_port ?? 5432),
          cdr_db_name: ast.cdr_db_name ?? instance?.cdr_db_name ?? undefined,
          cdr_db_user: ast.cdr_db_user ?? instance?.cdr_db_user ?? undefined,
          cdr_db_password: ast.cdr_db_password || undefined,
          recording_path: ast.recording_path ?? instance?.recording_path ?? undefined,
          enabled: astEnabled,
        },
      });
      setAst((p) => ({ ...p, ami_password: "", cdr_db_password: "" }));
      toast.success("PBX saved. Passwords are stored server-side only.");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the PBX.");
    } finally {
      setBusy(false);
    }
  }

  async function onCheckAsterisk() {
    if (!org || !instance) return;
    setBusy(true);
    try {
      const res = await checkAsterisk({ data: { organizationId: org.id, instanceId: instance.id } });
      if (res.ok) toast.success("CDR credentials are complete and ready for syncing.");
      else toast.error("The CDR database password is still missing.");
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Credentials are encrypted at rest and never sent to the browser. Saved keys are never displayed again.
        </p>
      </div>

      <Tabs defaultValue="elevenlabs">
        <TabsList>
          <TabsTrigger value="elevenlabs">ElevenLabs</TabsTrigger>
          <TabsTrigger value="asterisk">Asterisk / PBX</TabsTrigger>
        </TabsList>

        <TabsContent value="elevenlabs" className="mt-4 space-y-4">
          <section className="panel space-y-4 p-5">
            <header className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plug className="size-4 text-primary" />
                <h2 className="text-sm font-semibold">ElevenLabs Conversational AI</h2>
              </div>
              <div className="flex items-center gap-2">
                <StatusChip status={provider?.connection_status ?? "not configured"} />
                <span className="text-xs text-muted-foreground">
                  Last sync: {formatDateTime(provider?.last_sync_at)}
                </span>
              </div>
            </header>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="elName">Provider name</Label>
                <Input
                  id="elName"
                  value={elName}
                  onChange={(e) => setElName(e.target.value)}
                  placeholder={provider?.name ?? "ElevenLabs production"}
                  disabled={!canManage}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="elKey">API key</Label>
                <Input
                  id="elKey"
                  type="password"
                  value={elKey}
                  onChange={(e) => setElKey(e.target.value)}
                  placeholder={provider ? "•••••••• (saved)" : "sk_..."}
                  disabled={!canManage}
                />
              </div>
            </div>

            {provider?.last_error && <p className="text-xs text-destructive">{provider.last_error}</p>}

            <div className="flex flex-wrap gap-2">
              <Button onClick={onSaveElevenLabs} disabled={busy || !canManage}>
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}Save configuration
              </Button>
              <Button variant="outline" onClick={onTestElevenLabs} disabled={busy || !provider || !canManage}>
                Test connection &amp; fetch agents
              </Button>
            </div>
          </section>

          <section className="panel p-5">
            <h3 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Imported agents</h3>
            {data?.agents.length ? (
              <ul className="space-y-2">
                {data.agents.map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-sm">
                    <span>{a.name}</span>
                    <span className="num text-xs text-muted-foreground">{a.external_agent_id}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No agents yet. Save your API key and run the connection test to import them.
              </p>
            )}
          </section>
        </TabsContent>

        <TabsContent value="asterisk" className="mt-4">
          <section className="panel space-y-4 p-5">
            <header className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="size-4 text-primary" />
                <h2 className="text-sm font-semibold">Asterisk PBX &amp; CDR database</h2>
              </div>
              <div className="flex items-center gap-2">
                <StatusChip status={instance?.connection_status ?? "not configured"} />
                <Switch checked={astEnabled} onCheckedChange={setAstEnabled} disabled={!canManage} />
              </div>
            </header>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                ["name", "PBX name", instance?.name],
                ["asterisk_host", "Asterisk host", instance?.asterisk_host],
                ["recording_path", "Recording path", instance?.recording_path],
                ["ami_host", "AMI host", instance?.ami_host],
                ["ami_port", "AMI port", instance?.ami_port],
                ["ami_username", "AMI username", instance?.ami_username],
                ["cdr_db_host", "CDR database host", instance?.cdr_db_host],
                ["cdr_db_port", "CDR database port", instance?.cdr_db_port],
                ["cdr_db_name", "CDR database name", instance?.cdr_db_name],
                ["cdr_db_user", "CDR database user", instance?.cdr_db_user],
              ].map(([key, label, current]) => (
                <div className="space-y-2" key={key as string}>
                  <Label htmlFor={key as string}>{label as string}</Label>
                  <Input
                    id={key as string}
                    value={ast[key as string] ?? ""}
                    onChange={(e) => setAst((p) => ({ ...p, [key as string]: e.target.value }))}
                    placeholder={current != null ? String(current) : ""}
                    disabled={!canManage}
                  />
                </div>
              ))}

              <div className="space-y-2">
                <Label htmlFor="ami_password">AMI password</Label>
                <Input
                  id="ami_password"
                  type="password"
                  value={ast.ami_password ?? ""}
                  onChange={(e) => setAst((p) => ({ ...p, ami_password: e.target.value }))}
                  placeholder="•••••••• (write only)"
                  disabled={!canManage}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cdr_db_password">CDR database password</Label>
                <Input
                  id="cdr_db_password"
                  type="password"
                  value={ast.cdr_db_password ?? ""}
                  onChange={(e) => setAst((p) => ({ ...p, cdr_db_password: e.target.value }))}
                  placeholder="•••••••• (write only)"
                  disabled={!canManage}
                />
              </div>
            </div>

            {instance?.last_error && <p className="text-xs text-destructive">{instance.last_error}</p>}

            <div className="flex flex-wrap gap-2">
              <Button onClick={onSaveAsterisk} disabled={busy || !canManage}>
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}Save configuration
              </Button>
              <Button variant="outline" onClick={onCheckAsterisk} disabled={busy || !instance || !canManage}>
                Check credentials
              </Button>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
