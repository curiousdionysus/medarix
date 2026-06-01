import { Badge } from "@/components/ui/badge";

import {

  modalityBadgeClass,

  modalityDisplayCode,

} from "@/features/studies/modality-styles";

import { useT } from "@/features/i18n/locale-context";
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



export function ModalityBadge({ modality, className }: { modality?: string | null; className?: string }) {

  return (

    <span className={modalityBadgeClass(modality, className)} aria-label={modality ?? undefined}>

      {modalityDisplayCode(modality)}

    </span>

  );

}


