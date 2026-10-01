import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { EmptyState } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/sip-numbers")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "SIP numbers · AI Voice Call Manager" },
      { name: "description", content: "Manage SIP providers, numbers and per-minute billing rates." },
      { property: "og:title", content: "SIP numbers · AI Voice Call Manager" },
      { property: "og:description", content: "Manage SIP providers, numbers and per-minute billing rates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SipPage,
});

function SipPage() {
  const { org, canManage } = useOrg();
  const qc = useQueryClient();
  const [providerForm, setProviderForm] = useState({ name: "", incoming: "0", outgoing: "0", increment: "60", currency: "USD" });
  const [numberForm, setNumberForm] = useState({ number: "", label: "", providerId: "", direction: "inbound" });

  const { data } = useQuery({
    queryKey: ["sip", org?.id],
    enabled: !!org,
    queryFn: async () => {
      const [providers, numbers] = await Promise.all([
        supabase.from("sip_providers").select("*").eq("organization_id", org!.id).order("name"),
        supabase.from("sip_numbers").select("*, sip_providers(name)").eq("organization_id", org!.id).order("number"),
      ]);
      return { providers: providers.data ?? [], numbers: numbers.data ?? [] };
    },
  });

  const reload = () => qc.invalidateQueries({ queryKey: ["sip", org?.id] });

  async function addProvider() {
    if (!org || !providerForm.name) return;
    const { error } = await supabase.from("sip_providers").insert({
      organization_id: org.id,
      name: providerForm.name,
      incoming_rate: Number(providerForm.incoming),
      outgoing_rate: Number(providerForm.outgoing),
      billing_increment: Number(providerForm.increment),
      currency: providerForm.currency,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("SIP provider added.");
      setProviderForm({ name: "", incoming: "0", outgoing: "0", increment: "60", currency: "USD" });
      reload();
    }
  }

  async function addNumber() {
    if (!org || !numberForm.number) return;
    const { error } = await supabase.from("sip_numbers").insert({
      organization_id: org.id,
      number: numberForm.number,
      label: numberForm.label || null,
      sip_provider_id: numberForm.providerId || null,
      direction: numberForm.direction as "inbound" | "outbound" | "internal",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("SIP number added.");
      setNumberForm({ number: "", label: "", providerId: "", direction: "inbound" });
      reload();
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">SIP providers &amp; numbers</h1>
        <p className="text-sm text-muted-foreground">Rates here drive the SIP side of every call's cost calculation.</p>
      </div>

      {canManage && (
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="panel space-y-3 p-5">
            <h2 className="text-sm font-semibold">Add SIP provider</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Provider name" value={providerForm.name} onChange={(v) => setProviderForm((p) => ({ ...p, name: v }))} />
              <Field label="Currency" value={providerForm.currency} onChange={(v) => setProviderForm((p) => ({ ...p, currency: v }))} />
              <Field label="Incoming rate / min" value={providerForm.incoming} onChange={(v) => setProviderForm((p) => ({ ...p, incoming: v }))} />
              <Field label="Outgoing rate / min" value={providerForm.outgoing} onChange={(v) => setProviderForm((p) => ({ ...p, outgoing: v }))} />
              <Field label="Billing increment (sec)" value={providerForm.increment} onChange={(v) => setProviderForm((p) => ({ ...p, increment: v }))} />
            </div>
            <Button onClick={addProvider}>Add provider</Button>
          </section>

          <section className="panel space-y-3 p-5">
            <h2 className="text-sm font-semibold">Add SIP number</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Number" value={numberForm.number} onChange={(v) => setNumberForm((p) => ({ ...p, number: v }))} />
              <Field label="Label" value={numberForm.label} onChange={(v) => setNumberForm((p) => ({ ...p, label: v }))} />
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={numberForm.providerId} onValueChange={(v) => setNumberForm((p) => ({ ...p, providerId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                  <SelectContent>
                    {(data?.providers ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Direction</Label>
                <Select value={numberForm.direction} onValueChange={(v) => setNumberForm((p) => ({ ...p, direction: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inbound">Inbound</SelectItem>
                    <SelectItem value="outbound">Outbound</SelectItem>
                    <SelectItem value="internal">Internal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={addNumber}>Add number</Button>
          </section>
        </div>
      )}

      {(data?.numbers.length ?? 0) === 0 ? (
        <EmptyState title="No SIP numbers yet" description="Add a provider and its numbers so calls can be priced automatically." />
      ) : (
        <div className="panel overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Direction</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.numbers ?? []).map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="num">{n.number}</TableCell>
                  <TableCell>{n.label ?? "—"}</TableCell>
                  <TableCell>{(n as unknown as { sip_providers?: { name: string } }).sip_providers?.name ?? "—"}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{n.direction}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
