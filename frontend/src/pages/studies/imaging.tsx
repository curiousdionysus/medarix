import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Image, FileText, ChevronRight, AlertTriangle } from "lucide-react";
import { useStudies, type StudyFilters } from "@/features/studies/api";
import { StudyFilterBar } from "@/features/studies/filter-bar";
import { useT } from "@/features/i18n/locale-context";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ModalityBadge, ReportStatusBadge, PriorityBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/utils";

export default function ImagingPage() {
  const t = useT();
  const [filters, setFilters] = React.useState<StudyFilters>({ limit: 100 });
  const { data, isLoading, isError } = useStudies(filters);
  const navigate = useNavigate();

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("imaging.title")}
        description={t("imaging.description")}
        icon={<Image className="size-5" />}
      />

      <StudyFilterBar value={filters} onChange={setFilters} />

      <Card>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            className="border-0"
            icon={AlertTriangle}
            title={t("imaging.loadFail")}
            description={t("imaging.loadFailDesc")}
          />
        ) : data?.length ? (
          <div className="max-h-[calc(100vh-22rem)] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>{t("imaging.patient")}</TableHead>
                  <TableHead>{t("imaging.modality")}</TableHead>
                  <TableHead>{t("imaging.studyDescription")}</TableHead>
                  <TableHead>{t("imaging.accession")}</TableHead>
                  <TableHead>{t("imaging.studyDate")}</TableHead>
                  <TableHead>{t("imaging.priority")}</TableHead>
                  <TableHead>{t("imaging.report")}</TableHead>
                  <TableHead className="text-right">{t("imaging.action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((s) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/workspace/reports/${s.id}`)}
                  >
                    <TableCell className="font-medium">{s.patient_name || t("common.unnamedPatient")}</TableCell>
                    <TableCell>
                      <ModalityBadge modality={s.modality} />
                    </TableCell>
                    <TableCell className="max-w-56 truncate text-muted-foreground">
                      {s.study_description || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.accession_number || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(s.study_date)}
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={(s.priority as never) ?? null} />
                    </TableCell>
                    <TableCell>
                      {s.report_status ? (
                        <ReportStatusBadge status={s.report_status} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" aria-label={t("imaging.openReportAria")}>
                        <ChevronRight />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState
            className="border-0"
            icon={FileText}
            title={t("imaging.notFound")}
            description={t("imaging.notFoundEmpty")}
          />
        )}
      </Card>
      {data && data.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {t("imaging.studiesShown", { count: String(data.length) })}
        </p>
      )}
    </div>
  );
}
