import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "destructive" | "primary";
}) {
  const toneClass = {
    default: "text-foreground",
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  }[tone];

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
        {Icon && <Icon className="size-4 text-muted-foreground" />}
      </div>
      <div className={`stat-value mt-2 text-2xl font-semibold ${toneClass}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="panel flex flex-col items-center justify-center gap-2 p-12 text-center">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
