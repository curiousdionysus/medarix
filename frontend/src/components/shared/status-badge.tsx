import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReportStatus, StudyPriority } from "@/types/api";

const REPORT_STATUS: Record<ReportStatus, { label: string; variant: Parameters<typeof Badge>[0]["variant"] }> = {
  draft: { label: "Taslak", variant: "muted" },
  preliminary: { label: "Ön Rapor", variant: "warning" },
  signed: { label: "İmzalı", variant: "success" },
  amended: { label: "Düzeltme", variant: "info" },
};

export function ReportStatusBadge({ status }: { status?: ReportStatus | string | null }) {
  const meta = REPORT_STATUS[(status as ReportStatus) ?? "draft"] ?? REPORT_STATUS.draft;
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

const PRIORITY: Record<StudyPriority, { label: string; variant: Parameters<typeof Badge>[0]["variant"] }> = {
  routine: { label: "Rutin", variant: "muted" },
  urgent: { label: "Acil", variant: "warning" },
  stat: { label: "STAT", variant: "destructive" },
};

export function PriorityBadge({ priority }: { priority?: StudyPriority | null }) {
  if (!priority) return null;
  const meta = PRIORITY[priority];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
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
