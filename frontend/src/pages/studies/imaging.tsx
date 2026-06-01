import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Image, FileText, ChevronRight, AlertTriangle } from "lucide-react";
import { useStudies, type StudyFilters } from "@/features/studies/api";
import { StudyFilterBar } from "@/features/studies/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ModalityBadge, ReportStatusBadge, PriorityBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/utils";

export default function ImagingPage() {
  const [filters, setFilters] = React.useState<StudyFilters>({ limit: 100 });
  const { data, isLoading, isError } = useStudies(filters);
  const navigate = useNavigate();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Görüntüleme Çalışmaları"
        description="Tüm DICOM çalışmalarını arayın, filtreleyin ve raporlamaya geçin."
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
            title="Çalışmalar yüklenemedi"
            description="Lütfen filtreleri kontrol edip tekrar deneyin."
          />
        ) : data?.length ? (
          <div className="max-h-[calc(100vh-22rem)] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>Hasta</TableHead>
                <TableHead>Modalite</TableHead>
                <TableHead>Açıklama</TableHead>
                <TableHead>Erişim No</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Öncelik</TableHead>
                <TableHead>Rapor</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/workspace/reports/${s.id}`)}
                >
                  <TableCell className="font-medium">{s.patient_name || "İsimsiz hasta"}</TableCell>
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
                    {s.report_status ? <ReportStatusBadge status={s.report_status} /> : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon-sm" aria-label="Raporu aç">
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
            title="Çalışma bulunamadı"
            description="Medarix çalışma alanında arama kriterlerinize uyan radyoloji çalışması yok."
          />
        )}
      </Card>
      {data && data.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">{data.length} çalışma gösteriliyor</p>
      )}
    </div>
  );
}
