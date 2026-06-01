import { ChevronRight, ExternalLink, ImageOff, Images, Loader2 } from "lucide-react";
import { ModalityBadge, PriorityBadge, ReportStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useT } from "@/features/i18n/locale-context";
import { cn, formatStudyDateTime } from "@/lib/utils";
import type { StudyOut, StudyPriority } from "@/types/api";

const PRIORITY_WEIGHT: Record<string, number> = { stat: 0, urgent: 1, routine: 2 };

const ROW_ACCENT: Record<StudyPriority, string> = {
  stat: "border-l-destructive",
  urgent: "border-l-warning",
  routine: "border-l-transparent",
};

type Props = {
  studies: StudyOut[];
  loading: boolean;
  fetching?: boolean;
  patientFallback: string;
  onOpenStudy: (study: StudyOut) => void;
};

export function WorklistList({ studies, loading, fetching, patientFallback, onOpenStudy }: Props) {
  const t = useT();

  const sorted = [...studies].sort((a, b) => {
    const pw =
      (PRIORITY_WEIGHT[a.priority ?? "routine"] ?? 2) - (PRIORITY_WEIGHT[b.priority ?? "routine"] ?? 2);
    if (pw !== 0) return pw;
    const da = a.study_date ?? "";
    const db = b.study_date ?? "";
    return db.localeCompare(da);
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/30 px-4 py-2.5">
        <p className="text-sm text-muted-foreground">
          {loading ? (
            t("worklist.loading")
          ) : (
            <span className="font-medium text-foreground">
              {t("worklist.studiesFound", { count: String(sorted.length) })}
            </span>
          )}
        </p>
        {fetching ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            {t("worklist.refreshing")}
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      ) : sorted.length ? (
        <div className="max-h-[calc(100vh-17rem)] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[min(14rem,22vw)]">{t("imaging.patient")}</TableHead>
                <TableHead className="w-16">{t("imaging.modality")}</TableHead>
                <TableHead>{t("imaging.studyDescription")}</TableHead>
                <TableHead className="hidden w-36 font-mono md:table-cell">{t("imaging.accession")}</TableHead>
                <TableHead className="w-36 whitespace-nowrap">{t("filter.dateTime")}</TableHead>
                <TableHead className="w-24">{t("imaging.priority")}</TableHead>
                <TableHead className="w-28 hidden sm:table-cell">{t("imaging.report")}</TableHead>
                <TableHead className="w-24 text-center">{t("worklist.images")}</TableHead>
                <TableHead className="w-12 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((s) => {
                const priority = (s.priority ?? "routine") as StudyPriority;
                return (
                  <TableRow
                    key={s.id}
                    className={cn(
                      "cursor-pointer border-l-[3px] transition-colors",
                      ROW_ACCENT[priority] ?? ROW_ACCENT.routine,
                      "hover:bg-muted/50",
                    )}
                    onClick={() => onOpenStudy(s)}
                  >
                    <TableCell className="font-semibold text-card-foreground">
                      {s.patient_name || patientFallback}
                    </TableCell>
                    <TableCell>
                      <ModalityBadge modality={s.modality} />
                    </TableCell>
                    <TableCell className="max-w-md truncate text-muted-foreground">
                      {s.study_description || "—"}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                      {s.accession_number || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                      {formatStudyDateTime(s.study_date, s.study_time)}
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={s.priority} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {s.report_status ? (
                        <ReportStatusBadge status={s.report_status} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center justify-center gap-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={cn(
                                "inline-flex size-8 items-center justify-center rounded-md",
                                s.has_images ? "text-success" : "text-muted-foreground/60",
                              )}
                              aria-label={s.has_images ? t("worklist.hasImages") : t("worklist.noImages")}
                            >
                              {s.has_images ? (
                                <Images className="size-4" aria-hidden />
                              ) : (
                                <ImageOff className="size-4" aria-hidden />
                              )}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {s.has_images ? t("worklist.hasImages") : t("worklist.noImages")}
                          </TooltipContent>
                        </Tooltip>
                        {s.pacs_viewer_url ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t("worklist.openPacsViewer")}
                                onClick={() => window.open(s.pacs_viewer_url!, "_blank", "noopener,noreferrer")}
                              >
                                <ExternalLink className="size-4" aria-hidden />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("worklist.openPacsViewer")}</TooltipContent>
                          </Tooltip>
                        ) : s.accession_number ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex size-8 items-center justify-center text-muted-foreground/30">
                                <ExternalLink className="size-4" aria-hidden />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{t("worklist.viewerNotConfigured")}</TooltipContent>
                          </Tooltip>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        tabIndex={-1}
                        aria-label={t("worklist.openDictation")}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenStudy(s);
                        }}
                      >
                        <ChevronRight />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </Card>
  );
}
