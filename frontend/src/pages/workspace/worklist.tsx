import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ListChecks, Inbox, PenLine, CheckCircle2 } from "lucide-react";
import { useStudies, type StudyFilters } from "@/features/studies/api";
import { StudyFilterBar } from "@/features/studies/filter-bar";
import { useT } from "@/features/i18n/locale-context";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ModalityBadge, PriorityBadge } from "@/components/shared/status-badge";
import { cn, formatDate } from "@/lib/utils";
import type { StudyOut } from "@/types/api";

const PRIORITY_WEIGHT: Record<string, number> = { stat: 0, urgent: 1, routine: 2 };

function columnOf(s: StudyOut): "unreported" | "inprogress" | "done" {
  if (!s.report_status) return "unreported";
  if (s.report_status === "signed" || s.report_status === "amended") return "done";
  return "inprogress";
}

export default function WorklistPage() {
  const t = useT();
  const [filters, setFilters] = React.useState<StudyFilters>({ limit: 150 });
  const { data, isLoading } = useStudies(filters);
  const navigate = useNavigate();

  const COLUMNS = React.useMemo(
    () => [
      { id: "unreported" as const, title: t("worklist.unreported"), icon: Inbox, tone: "text-info" },
      { id: "inprogress" as const, title: t("worklist.inProgress"), icon: PenLine, tone: "text-warning" },
      { id: "done" as const, title: t("worklist.completed"), icon: CheckCircle2, tone: "text-success" },
    ],
    [t],
  );

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
        title={t("worklist.title")}
        description={t("worklist.description")}
        icon={<ListChecks className="size-5" />}
      />
      <StudyFilterBar value={filters} onChange={setFilters} />

      {!isLoading && total > 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{t("worklist.studiesFound", { count: String(total) })}</span>
          {total >= (filters.limit ?? 0) && filters.limit
            ? ` ${t("worklist.studiesLimit", { limit: String(filters.limit) })}`
            : ""}
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
                    className="cursor-pointer border-border/80 p-3 transition-colors hover:border-primary/40 hover:bg-card"
                    onClick={() => navigate(`/workspace/dictation?studyId=${s.id}`, { state: { study: s } })}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{s.patient_name || t("common.unnamedPatient")}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {s.study_description || "—"} · {s.accession_number || "—"}
                        </p>
                      </div>
                      <PriorityBadge priority={s.priority} />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <ModalityBadge modality={s.modality} />
                      <span className="text-xs text-muted-foreground">{formatDate(s.study_date)}</span>
                    </div>
                  </Card>
                ))
              ) : (
                <p className="py-6 text-center text-xs text-muted-foreground">{t("worklist.columnEmpty")}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {!isLoading && total === 0 && (
        <EmptyState icon={ListChecks} title={t("worklist.empty")} description={t("filter.search")} />
      )}
    </div>
  );
}
