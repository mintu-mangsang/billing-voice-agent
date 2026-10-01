import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useOrg } from "@/hooks/useOrg";
import { syncAsteriskCdr } from "@/lib/asterisk-sync.functions";

export function SyncCdrButton() {
  const { org } = useOrg();
  const qc = useQueryClient();
  const sync = useServerFn(syncAsteriskCdr);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!org) return;
    setBusy(true);
    try {
      const res = await sync({ data: { organizationId: org.id, full: false } });
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      await qc.invalidateQueries({ queryKey: ["calls"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={run} disabled={busy || !org} variant="outline" size="sm">
      <RefreshCw className={`mr-2 size-4 ${busy ? "animate-spin" : ""}`} />
      {busy ? "Syncing…" : "Sync / Refresh Asterisk CDR"}
    </Button>
  );
}
