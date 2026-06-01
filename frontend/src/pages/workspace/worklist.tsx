import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ListChecks, Inbox, PenLine, CheckCircle2 } from "lucide-react";
import { useStudies, type StudyFilters } from "@/features/studies/api";
import { StudyFilterBar } from "@/features/studies/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ModalityBadge, PriorityBadge } from "@/components/shared/status-badge";
import { cn, formatDate } from "@/lib/utils";
import type { StudyOut } from "@/types/api";

const PRIORITY_WEIGHT: Record<string, number> = { stat: 0, urgent: 1, routine: 2 };

const COLUMNS = [
  { id: "unreported", title: "Raporlanmamış", icon: Inbox, tone: "text-info" },
  { id: "inprogress", title: "Devam Eden", icon: PenLine, tone: "text-warning" },
  { id: "done", title: "Tamamlanan", icon: CheckCircle2, tone: "text-success" },
] as const;

function columnOf(s: StudyOut): (typeof COLUMNS)[number]["id"] {
  if (!s.report_status) return "unreported";
  if (s.report_status === "signed" || s.report_status === "amended") return "done";
  return "inprogress";
}

export default function WorklistPage() {
  const [filters, setFilters] = React.useState<StudyFilters>({ limit: 150 });
  const { data, isLoading } = useStudies(filters);
  const navigate = useNavigate();

  const grouped = React.useMemo(() => {
    const g: Record<string, StudyOut[]> = { unreported: [], inprogress: [], done: [] };
    (data ?? []).forEach((s) => g[columnOf(s)].push(s));
    Object.values(g).forEach((list) =>
      list.sort(
        (a, b) =>
          (PRIORITY_WEIGHT[a.priority ?? "routine"] ?? 2) - (PRIORITY_WEIGHT[b.priority ?? "routine"] ?? 2),
      ),
    );
    return g;
  }, [data]);

  const total = data?.length ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="İş Listesi"
        description="Çalışmaları raporlama durumuna ve önceliğe göre takip edin."
        icon={<ListChecks className="size-5" />}
      />
      <StudyFilterBar value={filters} onChange={setFilters} />

      {!isLoading && total > 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{total}</span> çalışma bulundu
          {total >= (filters.limit ?? 0) && filters.limit ? ` (ilk ${filters.limit} gösteriliyor, aramayı daraltın)` : ""}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => (
          <div key={col.id} className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <span className={cn("flex items-center gap-2 text-sm font-semibold", col.tone)}>
                <col.icon className="size-4" />
                {col.title}
              </span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                {grouped[col.id].length}
              </span>
            </div>

            <div className="flex max-h-[calc(100vh-20rem)] min-h-24 flex-col gap-2 overflow-y-auto rounded-xl bg-muted/40 p-2">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
              ) : grouped[col.id].length ? (
                grouped[col.id].map((s) => (
                  <Card
                    key={s.id}
                    onClick={() => navigate(`/workspace/dictation?studyId=${s.id}`, { state: { study: s } })}
                    className="cursor-pointer p-3 transition-all hover:border-primary/50 hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <ModalityBadge modality={s.modality} />
                      <PriorityBadge priority={(s.priority as never) ?? null} />
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold">{s.patient_name || "İsimsiz hasta"}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.study_description || "—"}</p>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {s.accession_number || "—"} · {formatDate(s.study_date)}
                    </p>
                  </Card>
                ))
              ) : (
                <p className="py-6 text-center text-xs text-muted-foreground">Bu kolonda çalışma yok</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {!isLoading && data?.length === 0 && (
        <EmptyState
          icon={ListChecks}
          title="İş listesi boş"
          description="Medarix çalışma alanında filtrelere uyan radyoloji çalışması yok."
        />
      )}
    </div>
  );
}
