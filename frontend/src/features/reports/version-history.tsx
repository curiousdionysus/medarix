import { History, RotateCcw } from "lucide-react";
import { useReportVersions } from "@/features/studies/api";
import { useT } from "@/features/i18n/locale-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ReportStatusBadge } from "@/components/shared/status-badge";
import { formatDateTime } from "@/lib/utils";
import type { ReportVersionOut } from "@/types/api";

interface Props {
  reportId?: string;
  onRestore: (version: ReportVersionOut) => void;
}

export function VersionHistory({ reportId, onRestore }: Props) {
  const t = useT();
  const { data, isLoading } = useReportVersions(reportId);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={!reportId}>
          <History />
          {t("versionHistory.title")}
          {data?.length ? <span className="ml-1 text-xs text-muted-foreground">({data.length})</span> : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("versionHistory.title")}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[28rem] space-y-2 overflow-y-auto">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
          ) : data?.length ? (
            data.map((v) => (
              <div key={v.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-bold">v{v.version}</span>
                    <ReportStatusBadge status={v.status} />
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => onRestore(v)}>
                    <RotateCcw /> {t("versionHistory.restore")}
                  </Button>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{v.content}</p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {v.author_name || t("common.unknown")} · {formatDateTime(v.created_at)}
                </p>
              </div>
            ))
          ) : (
            <EmptyState
              icon={History}
              title={t("versionHistory.empty")}
              description={t("versionHistory.emptyDesc")}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
