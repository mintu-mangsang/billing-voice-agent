import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Settings · AI Voice Call Manager" },
      { name: "description", content: "Workspace, currency, team roles, sync status and audit log settings." },
      { property: "og:title", content: "Settings · AI Voice Call Manager" },
      { property: "og:description", content: "Workspace, currency, team roles, sync status and audit log settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

const CURRENCIES = ["USD", "BDT", "EUR", "GBP"];

function SettingsPage() {
  const { user } = useAuth();
  const { org, role, canManage, refresh } = useOrg();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [rate, setRate] = useState("120");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (org) {
      setName(org.name);
      setCurrency(org.base_currency);
      setRate(String(org.usd_to_bdt));
    }
  }, [org]);

  const { data } = useQuery({
    queryKey: ["settings", org?.id],
    enabled: !!org,
    queryFn: async () => {
      const [members, jobs, logs, profile] = await Promise.all([
        supabase.from("organization_members").select("*").eq("organization_id", org!.id),
        supabase.from("sync_jobs").select("*").eq("organization_id", org!.id).order("started_at", { ascending: false }).limit(20),
        supabase.from("audit_logs").select("*").eq("organization_id", org!.id).order("created_at", { ascending: false }).limit(30),
        supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
      ]);
      return { members: members.data ?? [], jobs: jobs.data ?? [], logs: logs.data ?? [], profile: profile.data };
    },
  });

  useEffect(() => {
    if (data?.profile?.full_name) setFullName(data.profile.full_name);
  }, [data?.profile?.full_name]);

  async function saveOrg() {
    if (!org) return;
    const { error } = await supabase
      .from("organizations")
      .update({ name, base_currency: currency, usd_to_bdt: Number(rate) })
      .eq("id", org.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Workspace updated.");
      void refresh();
    }
  }

  async function saveProfile() {
    if (!user) return;
    const { error } = await supabase.from("profiles").upsert({ id: user.id, email: user.email, full_name: fullName });
    if (error) toast.error(error.message);
    else {
      toast.success("Profile updated.");
      qc.invalidateQueries({ queryKey: ["settings", org?.id] });
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Workspace configuration, team access and system activity.</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="currency">Currency</TabsTrigger>
          <TabsTrigger value="sync">Sync</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <section className="panel max-w-lg space-y-4 p-5">
            <div className="space-y-2">
              <Label htmlFor="orgName">Workspace name</Label>
              <Input id="orgName" value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} />
            </div>
            <div className="space-y-2">
              <Label>Your role</Label>
              <p className="text-sm capitalize text-muted-foreground">{role?.replace("_", " ")}</p>
            </div>
            <Button onClick={saveOrg} disabled={!canManage}>Save workspace</Button>
          </section>
        </TabsContent>

        <TabsContent value="profile" className="mt-4">
          <section className="panel max-w-lg space-y-4 p-5">
            <div className="space-y-2">
              <Label htmlFor="pName">Full name</Label>
              <Input id="pName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <Button onClick={saveProfile}>Save profile</Button>
          </section>
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <div className="panel overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.members ?? []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="num text-xs">{m.user_id}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{m.role.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(m.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="currency" className="mt-4">
          <section className="panel max-w-lg space-y-4 p-5">
            <div className="space-y-2">
              <Label>Base currency</Label>
              <Select value={currency} onValueChange={setCurrency} disabled={!canManage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate">USD → BDT exchange rate</Label>
              <Input id="rate" value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" disabled={!canManage} />
              <p className="text-xs text-muted-foreground">Costs are shown in the original currency with a BDT equivalent.</p>
            </div>
            <Button onClick={saveOrg} disabled={!canManage}>Save currency settings</Button>
          </section>
        </TabsContent>

        <TabsContent value="sync" className="mt-4">
          <div className="panel overflow-x-auto">
            {(data?.jobs.length ?? 0) === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No sync jobs have run yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Records</TableHead>
                    <TableHead>Started</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.jobs ?? []).map((j) => (
                    <TableRow key={j.id}>
                      <TableCell>{j.job_type}</TableCell>
                      <TableCell className="capitalize">{j.status}</TableCell>
                      <TableCell className="num text-right">{j.records_processed}</TableCell>
                      <TableCell>{formatDateTime(j.started_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <div className="panel overflow-x-auto">
            {(data?.logs.length ?? 0) === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No audit entries recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.logs ?? []).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.action}</TableCell>
                      <TableCell className="text-muted-foreground">{l.entity ?? "—"}</TableCell>
                      <TableCell>{formatDateTime(l.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
