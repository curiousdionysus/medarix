import * as React from "react";

import { CalendarDays, Clock3, Loader2, Search, SlidersHorizontal, X } from "lucide-react";

import type { StudyFilters } from "./api";

import { MODALITY_CODES, modalityChipClass } from "./modality-styles";

import { useT } from "@/features/i18n/locale-context";

import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";



const inputClass =

  "h-9 w-full rounded-lg border border-transparent bg-muted/60 px-3 text-sm text-foreground shadow-inner transition-[box-shadow,background-color,border-color] placeholder:text-muted-foreground/55 hover:bg-muted/80 focus:border-primary/30 focus:bg-card focus:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20";



const dateTimeInputClass =

  "h-9 min-w-0 flex-1 rounded-md border-0 bg-transparent px-1 text-xs tabular-nums text-foreground outline-none focus:ring-0";



function toISODate(d: Date): string {

  const tz = d.getTimezoneOffset() * 60000;

  return new Date(d.getTime() - tz).toISOString().slice(0, 10);

}



interface Props {

  value: StudyFilters;

  onChange: (next: StudyFilters) => void;

  onBeforeSearch?: (next: StudyFilters) => void | Promise<void>;

  /** When set, Clear resets the parent without applying a new search (e.g. worklist). */
  onClear?: () => void;

  searchPending?: boolean;

}



type Draft = {

  patient_tc: string;

  first_name: string;

  last_name: string;

  accession_number: string;

  from_date: string;

  to_date: string;

  from_time: string;

  to_time: string;

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

    from_time: value.from_time ?? "",

    to_time: value.to_time ?? "",

    modality: value.modality ?? [],

  };

}



function SectionLabel({ children }: { children: React.ReactNode }) {

  return (

    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">

      {children}

    </p>

  );

}



function FilterField({

  label,

  className,

  ...props

}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {

  return (

    <label className={cn("flex min-w-0 flex-col gap-1.5", className)}>

      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">{label}</span>

      <input {...props} className={inputClass} />

    </label>

  );

}



function filtersFromDraft(draft: Draft, value: StudyFilters): StudyFilters {

  return {

    limit: value.limit,

    include_imaging: value.include_imaging,

    has_report: value.has_report,

    patient_tc: draft.patient_tc.trim() || undefined,

    first_name: draft.first_name.trim() || undefined,

    last_name: draft.last_name.trim() || undefined,

    accession_number: draft.accession_number.trim() || undefined,

    from_date: draft.from_date || undefined,

    to_date: draft.to_date || undefined,

    from_time: draft.from_time || undefined,

    to_time: draft.to_time || undefined,

    modality: draft.modality.length ? draft.modality : undefined,

  };

}



function PresetChip({

  active,

  onClick,

  children,

}: {

  active: boolean;

  onClick: () => void;

  children: React.ReactNode;

}) {

  return (

    <button

      type="button"

      onClick={onClick}

      className={cn(

        "h-8 min-w-[4.5rem] rounded-lg px-3 text-xs font-semibold transition-all",

        active

          ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30"

          : "bg-card text-muted-foreground ring-1 ring-border/70 hover:bg-muted/70 hover:text-foreground",

      )}

    >

      {children}

    </button>

  );

}



function DateTimeBox({

  dateLabel,

  timeLabel,

  dateValue,

  timeValue,

  onDate,

  onTime,

}: {

  dateLabel: string;

  timeLabel: string;

  dateValue: string;

  timeValue: string;

  onDate: (v: string) => void;

  onTime: (v: string) => void;

}) {

  return (

    <div className="flex min-w-[11.5rem] flex-1 items-center gap-0.5 rounded-lg bg-card px-1 py-0.5 ring-1 ring-border/60">

      <CalendarDays className="ml-0.5 size-3.5 shrink-0 text-primary/70" aria-hidden />

      <input

        type="date"

        value={dateValue}

        onChange={(e) => onDate(e.target.value)}

        aria-label={dateLabel}

        className={cn(dateTimeInputClass, "min-w-[7.5rem]")}

      />

      <span className="text-border/80">|</span>

      <Clock3 className="size-3.5 shrink-0 text-primary/70" aria-hidden />

      <input

        type="time"

        value={timeValue}

        onChange={(e) => onTime(e.target.value)}

        aria-label={timeLabel}

        className={cn(dateTimeInputClass, "w-[4.5rem]")}

      />

    </div>

  );

}



export function StudyFilterBar({ value, onChange, onBeforeSearch, onClear, searchPending }: Props) {

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



  const search = async () => {

    const next = filtersFromDraft(draft, value);

    if (onBeforeSearch) await onBeforeSearch(next);

    onChange(next);

  };



  const applyPreset = async (days: number) => {

    const to = toISODate(new Date());

    const fromDate = new Date();

    fromDate.setDate(fromDate.getDate() - days);

    const from = toISODate(fromDate);

    const nextDraft = { ...draft, from_date: from, to_date: to, from_time: "", to_time: "" };

    setDraft(nextDraft);

    const next = filtersFromDraft(nextDraft, value);

    if (onBeforeSearch) await onBeforeSearch(next);

    onChange(next);

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

    if (onClear) {
      onClear();
      return;
    }

    onChange({ limit: value.limit, include_imaging: value.include_imaging, has_report: value.has_report });

  };



  const onKeyDown = (e: React.KeyboardEvent) => {

    if (e.key === "Enter") {

      e.preventDefault();

      void search();

    }

  };



  const hasDraft = !!(

    draft.patient_tc ||

    draft.first_name ||

    draft.last_name ||

    draft.accession_number ||

    draft.from_date ||

    draft.to_date ||

    draft.from_time ||

    draft.to_time ||

    draft.modality.length

  );



  return (

    <section

      className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-md shadow-black/[0.04]"

      onKeyDown={onKeyDown}

      aria-label={t("filter.panelLabel")}

    >

      <div className="flex items-center gap-2 border-b border-border/40 bg-gradient-to-r from-primary/[0.06] via-card to-card px-4 py-3">

        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">

          <SlidersHorizontal className="size-4" aria-hidden />

        </span>

        <div className="min-w-0 flex-1">

          <p className="text-sm font-semibold text-foreground">{t("filter.panelTitle")}</p>

          <p className="text-xs text-muted-foreground">{t("filter.panelHint")}</p>

        </div>

        {hasDraft ? (

          <Button

            type="button"

            variant="ghost"

            size="sm"

            onClick={clear}

            className="h-8 shrink-0 rounded-full text-xs text-muted-foreground"

          >

            <X className="size-3.5" />

            {t("filter.clear")}

          </Button>

        ) : null}

      </div>



      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">

        <FilterField

          label={t("filter.nationalId")}

          inputMode="numeric"

          maxLength={11}

          value={draft.patient_tc}

          onChange={(e) => set("patient_tc", e.target.value.replace(/\D/g, ""))}

          placeholder={t("filter.idPlaceholder")}

        />

        <FilterField

          label={t("filter.firstName")}

          value={draft.first_name}

          onChange={(e) => set("first_name", e.target.value)}

          placeholder={t("filter.firstNamePlaceholder")}

        />

        <FilterField

          label={t("filter.lastName")}

          value={draft.last_name}

          onChange={(e) => set("last_name", e.target.value)}

          placeholder={t("filter.lastNamePlaceholder")}

        />

        <FilterField

          label={t("filter.accession")}

          value={draft.accession_number}

          onChange={(e) => set("accession_number", e.target.value)}

          placeholder={t("filter.accessionPlaceholder")}

        />

      </div>



      <div className="grid gap-4 border-t border-border/40 bg-muted/20 p-4 lg:grid-cols-12 lg:items-end">

        <div className="lg:col-span-7">

          <SectionLabel>{t("filter.dateTime")}</SectionLabel>

          <div className="flex max-w-full items-center gap-2">

            <DateTimeBox

              dateLabel={t("filter.fromDate")}

              timeLabel={t("filter.fromTime")}

              dateValue={draft.from_date}

              timeValue={draft.from_time}

              onDate={(v) => set("from_date", v)}

              onTime={(v) => set("from_time", v)}

            />

            <span className="shrink-0 text-sm font-medium text-muted-foreground" aria-hidden>

              →

            </span>

            <DateTimeBox

              dateLabel={t("filter.toDate")}

              timeLabel={t("filter.toTime")}

              dateValue={draft.to_date}

              timeValue={draft.to_time}

              onDate={(v) => set("to_date", v)}

              onTime={(v) => set("to_time", v)}

            />

          </div>

        </div>



        <div className="lg:col-span-5">

          <SectionLabel>{t("filter.period")}</SectionLabel>

          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">

            {DATE_PRESETS.map((p) => (

              <PresetChip

                key={p.id}

                active={activePreset === p.id}

                onClick={() => void applyPreset(p.days)}

              >

                {p.label}

              </PresetChip>

            ))}

          </div>

        </div>



        <div className="lg:col-span-9">

          <SectionLabel>{t("filter.modality")}</SectionLabel>

          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-12">

            {MODALITY_CODES.map((m) => (

              <button

                key={m}

                type="button"

                aria-pressed={draft.modality.includes(m)}

                onClick={() => toggleModality(m)}

                className={modalityChipClass(m, draft.modality.includes(m))}

              >

                {m}

              </button>

            ))}

          </div>

        </div>



        <div className="flex lg:col-span-3 lg:justify-end lg:pb-0.5">

          <Button

            type="button"

            size="lg"

            onClick={() => void search()}

            disabled={searchPending}

            className="h-11 w-full rounded-xl px-6 shadow-lg shadow-primary/25 sm:w-auto sm:min-w-[9.5rem]"

          >

            {searchPending ? (

              <Loader2 className="size-4 animate-spin" aria-hidden />

            ) : (

              <Search className="size-4" aria-hidden />

            )}

            {t("filter.search")}

          </Button>

        </div>

      </div>

    </section>

  );

}


