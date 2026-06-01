import * as React from "react";
import { Search, X } from "lucide-react";
import type { StudyFilters } from "./api";
import { useT } from "@/features/i18n/locale-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MODALITIES = ["CT", "MR", "XR", "US", "MG", "NM"];

function toISODate(d: Date): string {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

interface Props {
  value: StudyFilters;
  onChange: (next: StudyFilters) => void;
}

type Draft = {
  patient_tc: string;
  first_name: string;
  last_name: string;
  accession_number: string;
  from_date: string;
  to_date: string;
  modality: string[];
};

function toDraft(value: StudyFilters): Draft {
  return {
    patient_tc: value.patient_tc ?? "",
    first_name: value.first_name ?? "",
    last_name: value.last_name ?? "",
    accession_number: value.accession_number ?? "",
    from_date: value.from_date ?? "",
    to_date: value.to_date ?? "",
    modality: value.modality ?? [],
  };
}

function Field({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={cn("flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2", className)}>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        {...props}
        className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
      />
    </label>
  );
}

export function StudyFilterBar({ value, onChange }: Props) {
  const t = useT();
  const [draft, setDraft] = React.useState<Draft>(() => toDraft(value));

  const DATE_PRESETS = React.useMemo(
    () => [
      { id: "1d", label: t("filter.today"), days: 0 },
      { id: "3d", label: t("filter.last3Days"), days: 2 },
      { id: "1w", label: t("filter.lastWeek"), days: 6 },
      { id: "1m", label: t("filter.lastMonth"), days: 29 },
    ],
    [t],
  );

  const set = <K extends keyof Draft>(key: K, val: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  const toggleModality = (m: string) =>
    setDraft((d) => {
      const next = new Set(d.modality);
      next.has(m) ? next.delete(m) : next.add(m);
      return { ...d, modality: Array.from(next) };
    });

  const search = () => {
    onChange({
      limit: value.limit,
      patient_tc: draft.patient_tc.trim() || undefined,
      first_name: draft.first_name.trim() || undefined,
      last_name: draft.last_name.trim() || undefined,
      accession_number: draft.accession_number.trim() || undefined,
      from_date: draft.from_date || undefined,
      to_date: draft.to_date || undefined,
      modality: draft.modality.length ? draft.modality : undefined,
    });
  };

  const applyPreset = (days: number) => {
    const to = toISODate(new Date());
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    const from = toISODate(fromDate);
    const next = { ...draft, from_date: from, to_date: to };
    setDraft(next);
    onChange({
      limit: value.limit,
      patient_tc: next.patient_tc.trim() || undefined,
      first_name: next.first_name.trim() || undefined,
      last_name: next.last_name.trim() || undefined,
      accession_number: next.accession_number.trim() || undefined,
      from_date: from,
      to_date: to,
      modality: next.modality.length ? next.modality : undefined,
    });
  };

  const activePreset = React.useMemo(() => {
    if (!draft.from_date || !draft.to_date) return null;
    if (draft.to_date !== toISODate(new Date())) return null;
    for (const p of DATE_PRESETS) {
      const f = new Date();
      f.setDate(f.getDate() - p.days);
      if (toISODate(f) === draft.from_date) return p.id;
    }
    return null;
  }, [draft.from_date, draft.to_date, DATE_PRESETS]);

  const clear = () => {
    setDraft(toDraft({ limit: value.limit }));
    onChange({ limit: value.limit });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      search();
    }
  };

  const hasDraft = !!(
    draft.patient_tc ||
    draft.first_name ||
    draft.last_name ||
    draft.accession_number ||
    draft.from_date ||
    draft.to_date ||
    draft.modality.length
  );

  return (
    <div
      className="overflow-hidden rounded-xl border border-border bg-card"
      onKeyDown={onKeyDown}
    >
      <div className="flex flex-col divide-y divide-border sm:flex-row sm:divide-x sm:divide-y-0">
        <Field
          label={t("filter.nationalId")}
          inputMode="numeric"
          maxLength={11}
          value={draft.patient_tc}
          onChange={(e) => set("patient_tc", e.target.value.replace(/\D/g, ""))}
          placeholder={t("filter.idPlaceholder")}
        />
        <Field
          label={t("filter.firstName")}
          value={draft.first_name}
          onChange={(e) => set("first_name", e.target.value)}
          placeholder={t("filter.firstNamePlaceholder")}
        />
        <Field
          label={t("filter.lastName")}
          value={draft.last_name}
          onChange={(e) => set("last_name", e.target.value)}
          placeholder={t("filter.lastNamePlaceholder")}
        />
        <Field
          label={t("filter.accession")}
          value={draft.accession_number}
          onChange={(e) => set("accession_number", e.target.value)}
          placeholder={t("filter.accessionPlaceholder")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border bg-muted/30 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.days)}
              aria-pressed={activePreset === p.id}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                activePreset === p.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <input
            type="date"
            value={draft.from_date}
            onChange={(e) => set("from_date", e.target.value)}
            className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="date"
            value={draft.to_date}
            onChange={(e) => set("to_date", e.target.value)}
            className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {MODALITIES.map((m) => {
            const active = draft.modality.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggleModality(m)}
                aria-pressed={active}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary",
                )}
              >
                {m}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {hasDraft && (
            <Button variant="ghost" size="sm" onClick={clear} className="h-8 px-2 text-xs">
              <X /> {t("filter.clear")}
            </Button>
          )}
          <Button size="sm" onClick={search} className="h-8">
            <Search /> {t("filter.search")}
          </Button>
        </div>
      </div>
    </div>
  );
}
