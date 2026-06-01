import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: "primary" | "accent" | "success" | "warning" | "destructive" | "info";
  hint?: string;
  delta?: number;
  loading?: boolean;
}

const TONES: Record<NonNullable<Props["tone"]>, string> = {
  primary: "bg-primary/12 text-primary",
  accent: "bg-accent/12 text-accent",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/12 text-destructive",
  info: "bg-info/12 text-info",
};

export function StatCard({ label, value, icon: Icon, tone = "primary", hint, delta, loading }: Props) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-20" />
          ) : (
            <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{value}</p>
          )}
        </div>
        <div className={cn("flex size-10 items-center justify-center rounded-lg", TONES[tone])}>
          <Icon className="size-5" />
        </div>
      </div>
      {(hint || delta != null) && !loading && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {delta != null && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-semibold",
                delta >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Math.abs(delta)}%
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </Card>
  );
}
