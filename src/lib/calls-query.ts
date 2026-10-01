import { supabase } from "@/integrations/supabase/client";

export type CallRow = {
  id: string;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  caller_number: string | null;
  destination_number: string | null;
  direction: string;
  status: string;
  disposition: string | null;
  duration_secs: number;
  billable_secs: number;
  ai_cost: number;
  sip_cost: number;
  total_cost: number;
  currency: string;
  call_successful: boolean | null;
  conversation_id: string | null;
  asterisk_uniqueid: string | null;
  asterisk_linkedid: string | null;
  external_agent_id: string | null;
  correlation_status: string;
  ai_agent_id: string | null;
  sip_number_id: string | null;
};

export async function fetchCallsInRange(orgId: string, from: Date, to: Date) {
  const { data, error } = await supabase
    .from("calls")
    .select("*")
    .eq("organization_id", orgId)
    .gte("started_at", from.toISOString())
    .lte("started_at", to.toISOString())
    .order("started_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as unknown as CallRow[];
}
