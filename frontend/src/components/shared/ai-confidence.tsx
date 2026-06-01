import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: number; // 0..1
  className?: string;
  showIcon?: boolean;
}

/** AI confidence chip used across dictation/report surfaces. */
export function AiConfidenceChip({ value, className, showIcon = true }: Props) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const tone =
    pct >= 85
      ? "text-success bg-success/12 ring-success/25"
      : pct >= 65
        ? "text-warning bg-warning/15 ring-warning/25"
        : "text-destructive bg-destructive/12 ring-destructive/25";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
        tone,
        className,
      )}
      title={`AI güven skoru: %${pct}`}
    >
      {showIcon && <Sparkles className="size-3" />}
      AI %{pct}
    </span>
  );
}
