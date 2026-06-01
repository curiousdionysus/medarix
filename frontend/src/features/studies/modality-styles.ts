import { cn } from "@/lib/utils";

/** Standard modality filter / badge codes (DICOM). */
export const MODALITY_CODES = [
  "DX",
  "CR",
  "CT",
  "MR",
  "XR",
  "US",
  "MG",
  "NM",
  "PT",
  "RF",
  "XA",
  "OT",
] as const;

const BADGE_CLASS: Record<string, string> = {
  CT: "text-mod-ct bg-mod-ct/14 ring-mod-ct/35",
  MR: "text-mod-mr bg-mod-mr/14 ring-mod-mr/35",
  XR: "text-mod-xr bg-mod-xr/14 ring-mod-xr/35",
  DX: "text-mod-dx bg-mod-dx/14 ring-mod-dx/35",
  CR: "text-mod-cr bg-mod-cr/14 ring-mod-cr/35",
  US: "text-mod-us bg-mod-us/14 ring-mod-us/35",
  MG: "text-mod-mg bg-mod-mg/14 ring-mod-mg/35",
  NM: "text-mod-nm bg-mod-nm/14 ring-mod-nm/35",
  PT: "text-mod-pt bg-mod-pt/14 ring-mod-pt/35",
  RF: "text-mod-rf bg-mod-rf/14 ring-mod-rf/35",
  XA: "text-mod-xa bg-mod-xa/14 ring-mod-xa/35",
  OT: "text-mod-ot bg-mod-ot/14 ring-mod-ot/35",
};

const CHIP_IDLE_CLASS: Record<string, string> = {
  CT: "bg-mod-ct/12 text-mod-ct ring-mod-ct/35 hover:bg-mod-ct/22",
  MR: "bg-mod-mr/12 text-mod-mr ring-mod-mr/35 hover:bg-mod-mr/22",
  XR: "bg-mod-xr/12 text-mod-xr ring-mod-xr/35 hover:bg-mod-xr/22",
  DX: "bg-mod-dx/12 text-mod-dx ring-mod-dx/35 hover:bg-mod-dx/22",
  CR: "bg-mod-cr/12 text-mod-cr ring-mod-cr/35 hover:bg-mod-cr/22",
  US: "bg-mod-us/12 text-mod-us ring-mod-us/35 hover:bg-mod-us/22",
  MG: "bg-mod-mg/12 text-mod-mg ring-mod-mg/35 hover:bg-mod-mg/22",
  NM: "bg-mod-nm/12 text-mod-nm ring-mod-nm/35 hover:bg-mod-nm/22",
  PT: "bg-mod-pt/12 text-mod-pt ring-mod-pt/35 hover:bg-mod-pt/22",
  RF: "bg-mod-rf/12 text-mod-rf ring-mod-rf/35 hover:bg-mod-rf/22",
  XA: "bg-mod-xa/12 text-mod-xa ring-mod-xa/35 hover:bg-mod-xa/22",
  OT: "bg-mod-ot/12 text-mod-ot ring-mod-ot/35 hover:bg-mod-ot/22",
};

const CHIP_ACTIVE_CLASS: Record<string, string> = {
  CT: "bg-mod-ct text-white ring-2 ring-mod-ct/50 shadow-sm",
  MR: "bg-mod-mr text-white ring-2 ring-mod-mr/50 shadow-sm",
  XR: "bg-mod-xr text-white ring-2 ring-mod-xr/50 shadow-sm",
  DX: "bg-mod-dx text-white ring-2 ring-mod-dx/50 shadow-sm",
  CR: "bg-mod-cr text-white ring-2 ring-mod-cr/50 shadow-sm",
  US: "bg-mod-us text-white ring-2 ring-mod-us/50 shadow-sm",
  MG: "bg-mod-mg text-white ring-2 ring-mod-mg/50 shadow-sm",
  NM: "bg-mod-nm text-white ring-2 ring-mod-nm/50 shadow-sm",
  PT: "bg-mod-pt text-white ring-2 ring-mod-pt/50 shadow-sm",
  RF: "bg-mod-rf text-white ring-2 ring-mod-rf/50 shadow-sm",
  XA: "bg-mod-xa text-white ring-2 ring-mod-xa/50 shadow-sm",
  OT: "bg-mod-ot text-white ring-2 ring-mod-ot/50 shadow-sm",
};

const FALLBACK_BADGE = "text-muted-foreground bg-muted ring-border";
const FALLBACK_CHIP_IDLE = "text-muted-foreground bg-card ring-1 ring-border/70 hover:bg-muted/80";
const FALLBACK_CHIP_ACTIVE = "bg-primary text-primary-foreground ring-2 ring-primary/40";

export function normalizeModalityCode(modality?: string | null): string {
  const code = (modality ?? "").trim().toUpperCase();
  return code || "—";
}

export function modalityBadgeClass(modality?: string | null, className?: string): string {
  const code = normalizeModalityCode(modality);
  return cn(
    "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset",
    BADGE_CLASS[code] ?? FALLBACK_BADGE,
    className,
  );
}

export function modalityChipClass(modality: string, selected: boolean): string {
  const code = normalizeModalityCode(modality);
  return cn(
    "inline-flex h-8 w-full items-center justify-center rounded-lg text-[11px] font-bold uppercase transition-all",
    selected
      ? (CHIP_ACTIVE_CLASS[code] ?? FALLBACK_CHIP_ACTIVE)
      : (CHIP_IDLE_CLASS[code] ?? FALLBACK_CHIP_IDLE),
  );
}

export function modalityDisplayCode(modality?: string | null): string {
  const code = normalizeModalityCode(modality);
  return code.length > 3 ? code.slice(0, 3) : code;
}
