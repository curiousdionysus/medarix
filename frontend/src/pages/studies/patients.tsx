import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Users, Search, CalendarClock, FileText, X } from "lucide-react";
import { usePatients, usePatientTimeline } from "@/features/patients/api";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ModalityBadge, ReportStatusBadge } from "@/components/shared/status-badge";
import { formatDate, initials } from "@/lib/utils";
import type { PatientSummary } from "@/types/api";

export default function PatientsPage() {
  const [term, setTerm] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<PatientSummary | null>(null);
  const { data, isLoading } = usePatients(query || undefined);

  React.useEffect(() => {
    const id = setTimeout(() => setQuery(term.trim()), 350);
    return () => clearTimeout(id);
  }, [term]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Hastalar"
        description="Hasta kayıtlarını görüntüleyin ve çalışma geçmişini inceleyin."
        icon={<Users className="size-5" />}
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Hasta adı ile ara…" className="pl-9" />
        {term && (
          <button onClick={() => setTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : data?.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
              onClick={() => setSelected(p)}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <Avatar className="size-11">
                  <AvatarFallback>{initials(p.patient_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.patient_name || "İsimsiz hasta"}</p>
                  <p className="text-xs text-muted-foreground">{p.study_count} çalışma · Son: {formatDate(p.last_study_date)}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.modalities.slice(0, 5).map((m) => (
                      <ModalityBadge key={m} modality={m} />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={Users} title="Hasta bulunamadı" description="Arama kriterlerinize uyan hasta yok." />
      )}

      <PatientTimelineDialog patient={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function PatientTimelineDialog({ patient, onClose }: { patient: PatientSummary | null; onClose: () => void }) {
  const { data, isLoading } = usePatientTimeline(patient?.id);
  const navigate = useNavigate();

  return (
    <Dialog open={!!patient} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Avatar className="size-9">
              <AvatarFallback>{initials(patient?.patient_name)}</AvatarFallback>
            </Avatar>
            {patient?.patient_name || "İsimsiz hasta"}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[26rem] overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : data?.length ? (
            <ol className="relative space-y-4 border-l border-border pl-5">
              {data.map((entry) => (
                <li key={entry.study_id} className="relative">
                  <span className="absolute -left-[1.42rem] top-1 flex size-3 rounded-full bg-primary ring-4 ring-card" />
                  <button
                    onClick={() => {
                      navigate(`/workspace/reports/${entry.study_id}`);
                      onClose();
                    }}
                    className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/50 hover:bg-secondary"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <ModalityBadge modality={entry.modality} />
                        <span className="text-sm font-medium">{entry.study_description || "Açıklama yok"}</span>
                      </span>
                      {entry.report_status && <ReportStatusBadge status={entry.report_status} />}
                    </div>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarClock className="size-3.5" />
                      {formatDate(entry.study_date)} · {entry.accession_number || "—"}
                    </p>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState icon={FileText} title="Çalışma yok" description="Bu hasta için kayıtlı çalışma bulunmuyor." />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
