import type { Locale } from "./locale-context";

export const REPORT_SECTION_KEYS = [
  "examination",
  "clinical",
  "comparison",
  "findings",
  "conclusion",
  "recommendation",
] as const;

export type ReportSectionKey = (typeof REPORT_SECTION_KEYS)[number];

export type ReportSectionDef = {
  key: ReportSectionKey;
  heading: string;
  label: string;
};

const SECTIONS: Record<Locale, ReportSectionDef[]> = {
  tr: [
    { key: "examination", heading: "İNCELEME", label: "İnceleme" },
    { key: "clinical", heading: "KLİNİK BİLGİ", label: "Klinik Bilgi" },
    { key: "comparison", heading: "KARŞILAŞTIRMA", label: "Karşılaştırma" },
    { key: "findings", heading: "BULGULAR", label: "Bulgular" },
    { key: "conclusion", heading: "SONUÇ", label: "Sonuç" },
    { key: "recommendation", heading: "ÖNERİ", label: "Öneri" },
  ],
  en: [
    { key: "examination", heading: "EXAMINATION", label: "Examination" },
    { key: "clinical", heading: "CLINICAL HISTORY", label: "Clinical history" },
    { key: "comparison", heading: "COMPARISON", label: "Comparison" },
    { key: "findings", heading: "FINDINGS", label: "Findings" },
    { key: "conclusion", heading: "IMPRESSION", label: "Impression" },
    { key: "recommendation", heading: "RECOMMENDATION", label: "Recommendation" },
  ],
};

/** Legacy Turkish keys stored in DB — map to canonical keys */
const LEGACY_KEY_MAP: Record<string, ReportSectionKey> = {
  inceleme: "examination",
  klinik: "clinical",
  karsilastirma: "comparison",
  bulgular: "findings",
  sonuc: "conclusion",
  oneri: "recommendation",
};

export function getReportSections(locale: Locale): ReportSectionDef[] {
  return SECTIONS[locale];
}

export function legacySectionKey(key: string): ReportSectionKey | null {
  return LEGACY_KEY_MAP[key] ?? (REPORT_SECTION_KEYS.includes(key as ReportSectionKey) ? (key as ReportSectionKey) : null);
}
