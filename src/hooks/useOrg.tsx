import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppRole = "super_admin" | "admin" | "manager" | "viewer";

export type Org = {
  id: string;
  name: string;
  slug: string;
  base_currency: string;
  usd_to_bdt: number;
};

type Membership = { org: Org; role: AppRole };

type OrgState = {
  loading: boolean;
  orgs: Membership[];
  org: Org | null;
  role: AppRole | null;
  canManage: boolean;
  setOrgId: (id: string) => void;
  refresh: () => Promise<void>;
};

const OrgContext = createContext<OrgState>({
  loading: true,
  orgs: [],
  org: null,
  role: null,
  canManage: false,
  setOrgId: () => {},
  refresh: async () => {},
});

const STORAGE_KEY = "avcm.active_org";

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "workspace"
  );
}

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<Membership[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setOrgs([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data } = await supabase
      .from("organization_members")
      .select("role, organizations(id, name, slug, base_currency, usd_to_bdt)")
      .eq("user_id", user.id);

    let memberships: Membership[] = (data ?? [])
      .filter((row) => row.organizations)
      .map((row) => ({
        role: row.role as AppRole,
        org: row.organizations as unknown as Org,
      }));

    if (memberships.length === 0) {
      const base = user.email?.split("@")[0] ?? "workspace";
      const { data: created } = await supabase
        .from("organizations")
        .insert({ name: `${base}'s workspace`, slug: `${slugify(base)}-${Date.now().toString(36)}` })
        .select("id, name, slug, base_currency, usd_to_bdt")
        .single();

      if (created) {
        await supabase
          .from("organization_members")
          .insert({ organization_id: created.id, user_id: user.id, role: "super_admin" });
        memberships = [{ org: created as Org, role: "super_admin" }];
      }
    }

    setOrgs(memberships);
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const next = memberships.find((m) => m.org.id === stored)?.org.id ?? memberships[0]?.org.id ?? null;
    setActiveId(next);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = orgs.find((m) => m.org.id === activeId) ?? null;

  return (
    <OrgContext.Provider
      value={{
        loading,
        orgs,
        org: current?.org ?? null,
        role: current?.role ?? null,
        canManage: current ? ["super_admin", "admin"].includes(current.role) : false,
        setOrgId: (id) => {
          setActiveId(id);
          if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
        },
        refresh: load,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}
