import { Badge } from "@/components/ui/badge";
import { useT } from "@/features/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { ReportStatus, StudyPriority } from "@/types/api";

const REPORT_VARIANT: Record<ReportStatus, Parameters<typeof Badge>[0]["variant"]> = {
  draft: "muted",
  preliminary: "warning",
  signed: "success",
  amended: "info",
};

export function ReportStatusBadge({ status }: { status?: ReportStatus | string | null }) {
  const t = useT();
  const key = (status as ReportStatus) ?? "draft";
  const variant = REPORT_VARIANT[key] ?? REPORT_VARIANT.draft;
  const labelKey = `status.${key}` as const;
  const label = t(labelKey) !== labelKey ? t(labelKey) : t("status.draft");
  return <Badge variant={variant}>{label}</Badge>;
}

const PRIORITY_VARIANT: Record<StudyPriority, Parameters<typeof Badge>[0]["variant"]> = {
  routine: "muted",
  urgent: "warning",
  stat: "destructive",
};

export function PriorityBadge({ priority }: { priority?: StudyPriority | null }) {
  const t = useT();
  if (!priority) return null;
  const labelKey = `status.${priority}`;
  const label = t(labelKey);
  return <Badge variant={PRIORITY_VARIANT[priority]}>{label}</Badge>;
}

const MOD_CLASS: Record<string, string> = {
  CT: "text-mod-ct bg-mod-ct/12 ring-mod-ct/30",
  MR: "text-mod-mr bg-mod-mr/12 ring-mod-mr/30",
  XR: "text-mod-xr bg-mod-xr/12 ring-mod-xr/30",
  US: "text-mod-us bg-mod-us/12 ring-mod-us/30",
  MG: "text-mod-mg bg-mod-mg/12 ring-mod-mg/30",
  NM: "text-mod-nm bg-mod-nm/12 ring-mod-nm/30",
};

export function ModalityBadge({ modality, className }: { modality?: string | null; className?: string }) {
  const code = (modality ?? "—").toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-bold ring-1 ring-inset",
        MOD_CLASS[code] ?? "text-muted-foreground bg-muted ring-border",
        className,
      )}
    >
      {code}
    </span>
  );
}
