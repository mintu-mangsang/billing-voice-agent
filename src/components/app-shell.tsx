import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  AudioLines,
  BarChart3,
  Building2,
  Cable,
  CircleUser,
  FileBarChart,
  Hash,
  LayoutDashboard,
  LogOut,
  Mic,
  PhoneCall,
  Settings,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/calls", label: "Calls", icon: PhoneCall },
  { to: "/agents", label: "AI Agents", icon: Mic },
  { to: "/sip-numbers", label: "SIP Numbers", icon: Hash },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/integrations", label: "Integrations", icon: Cable },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  viewer: "Agent / Viewer",
};

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { org, orgs, role, setOrgId } = useOrg();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary/15 text-primary">
            <AudioLines className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-sidebar-foreground">Voice Call Manager</div>
            <div className="text-[11px] text-muted-foreground">Control room</div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={[
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_0_var(--color-primary)]"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                ].join(" ")}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border px-4 py-3 text-[11px] text-muted-foreground">
          {role ? ROLE_LABEL[role] : "—"}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Building2 className="size-4 text-primary" />
                <span className="max-w-40 truncate">{org?.name ?? "No workspace"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {orgs.map((m) => (
                <DropdownMenuItem key={m.org.id} onClick={() => setOrgId(m.org.id)}>
                  {m.org.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="ml-auto flex items-center gap-2">
            <nav className="flex gap-1 lg:hidden">
              {NAV.slice(0, 4).map((item) => (
                <Link key={item.to} to={item.to} className="rounded-md p-2 text-muted-foreground hover:text-foreground">
                  <item.icon className="size-4" />
                </Link>
              ))}
            </nav>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <CircleUser className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                  {user?.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                  <Settings className="mr-2 size-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    void navigate({ to: "/auth" });
                  }}
                >
                  <LogOut className="mr-2 size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
