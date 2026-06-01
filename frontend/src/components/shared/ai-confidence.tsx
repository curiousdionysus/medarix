import { Sparkles } from "lucide-react";
import { useT } from "@/features/i18n/locale-context";
import { cn } from "@/lib/utils";

export function AiConfidenceChip({ value, className }: { value: number; className?: string }) {
  const t = useT();
  const pct = Math.round(value * 100);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent",
        className,
      )}
      title={t("aiConfidence.title", { pct: String(pct) })}
    >
      <Sparkles className="size-3" />
      {t("aiConfidence.label", { pct: String(pct) })}
    </span>
  );
}
