import { apiErrorMessage } from "@/lib/api";
import { getReportSections, type ReportSectionDef, type ReportSectionKey } from "./report-sections";
import { getStoredLocale, translateForLocale, useLocale, useT, type Locale } from "./locale-context";

export function useApiError() {
  const t = useT();
  return (error: unknown, key: string) => apiErrorMessage(error, t(key));
}

export function useReportSections(): ReportSectionDef[] {
  const { locale } = useLocale();
  return getReportSections(locale);
}

export function auditActionLabel(action: string, locale?: Locale): string {
  const loc = locale ?? getStoredLocale();
  const key = `audit.${action}`;
  const v = translateForLocale(loc, key);
  return v !== key ? v : action;
}

export function auditCategoryLabel(prefix: string, locale?: Locale): string {
  const loc = locale ?? getStoredLocale();
  const map: Record<string, string> = {
    auth: "audit.catAuth",
    report: "audit.catReport",
    report_template: "audit.catTemplate",
    ai: "audit.catAi",
    study: "audit.catStudy",
    image: "audit.catImage",
    pacs: "audit.catPacs",
    admin: "audit.catAdmin",
    recording: "audit.catRecording",
  };
  const key = map[prefix] ?? "audit.catOther";
  return translateForLocale(loc, key);
}

export type { ReportSectionKey };
