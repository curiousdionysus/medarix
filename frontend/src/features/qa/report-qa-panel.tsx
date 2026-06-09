import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/features/i18n/locale-context";
import type { ReportQAOut } from "@/types/api";
import { cn } from "@/lib/utils";

function riskVariant(level: string): "default" | "secondary" | "destructive" {
  if (level === "low") return "default";
  if (level === "medium") return "secondary";
  return "destructive";
}

function RiskIcon({ level }: { level: string }) {
  if (level === "low") return <CheckCircle2 className="size-4 text-emerald-600" />;
  if (level === "medium") return <AlertTriangle className="size-4 text-amber-600" />;
  return <ShieldAlert className="size-4 text-destructive" />;
}

export function ReportQAPanel({ qa, className }: { qa: ReportQAOut; className?: string }) {
  const t = useT();
  const criticalCount = qa.findings.filter((f) => f.severity === "critical").length;

  return (
    <Card className={cn("border-dashed", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{t("qa.title")}</CardTitle>
          <div className="flex items-center gap-2">
            <RiskIcon level={qa.risk_level} />
            <Badge variant={riskVariant(qa.risk_level)}>
              {t(`qa.risk.${qa.risk_level}`)} · {qa.overall_score}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <Metric label={t("qa.metrics.measurement")} value={qa.scores.measurement_accuracy} />
          <Metric label={t("qa.metrics.laterality")} value={qa.scores.laterality_accuracy} />
          <Metric label={t("qa.metrics.entities")} value={qa.scores.entity_preservation} />
          <Metric label={t("qa.metrics.transcription")} value={qa.scores.transcription_confidence} />
          <Metric label={t("qa.metrics.reviewer")} value={qa.scores.reviewer_confidence} />
        </div>

        {criticalCount > 0 && (
          <p className="text-destructive font-medium">
            {t("qa.criticalCount", { count: String(criticalCount) })}
          </p>
        )}

        {qa.findings.length > 0 && (
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border bg-muted/30 p-2 text-xs">
            {qa.findings.slice(0, 12).map((f, i) => (
              <li key={`${f.type}-${i}`} className="flex gap-2">
                <span className="shrink-0 uppercase text-muted-foreground">{f.severity}</span>
                <span>{f.message}</span>
              </li>
            ))}
          </ul>
        )}

        {typeof qa.reviewer_findings?.summary === "string" && (
          <p className="text-muted-foreground text-xs italic">{qa.reviewer_findings.summary}</p>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-semibold">{pct}%</div>
    </div>
  );
}
