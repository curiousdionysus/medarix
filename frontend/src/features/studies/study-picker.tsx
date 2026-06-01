import * as React from "react";
import { Search, FileSearch, X } from "lucide-react";
import { useStudies } from "./api";
import type { StudyOut } from "@/types/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ModalityBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/utils";

interface Props {
  value?: StudyOut | null;
  onSelect: (study: StudyOut) => void;
  trigger?: React.ReactNode;
}

export function StudyPicker({ onSelect, trigger }: Props) {
  const [open, setOpen] = React.useState(false);
  const [term, setTerm] = React.useState("");
  const [query, setQuery] = React.useState("");

  const { data, isLoading } = useStudies({ last_name: query || undefined, limit: 30 }, open);

  React.useEffect(() => {
    const id = setTimeout(() => setQuery(term.trim()), 350);
    return () => clearTimeout(id);
  }, [term]);

  const handleSelect = (study: StudyOut) => {
    onSelect(study);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <FileSearch />
            Çalışma Bağla
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Çalışma Seç</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Hasta soyadı ile ara…"
            className="pl-9"
          />
          {term && (
            <button
              onClick={() => setTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="max-h-80 space-y-1.5 overflow-y-auto">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
          ) : data?.length ? (
            data.map((study) => (
              <button
                key={study.id}
                onClick={() => handleSelect(study)}
                className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/50 hover:bg-secondary"
              >
                <ModalityBadge modality={study.modality} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{study.patient_name || "İsimsiz hasta"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {study.study_description || "Açıklama yok"} · {study.accession_number || "—"}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDate(study.study_date)}</span>
              </button>
            ))
          ) : (
            <EmptyState icon={FileSearch} title="Çalışma bulunamadı" description="Arama kriterlerinizi değiştirin." />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
