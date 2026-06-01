import type { BadgeProps } from "@/components/ui/badge";
import { auditActionLabel, auditCategoryLabel } from "@/features/i18n/helpers";
import type { Locale } from "@/features/i18n/locale-context";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

interface CategoryMeta {
  label: string;
  variant: BadgeVariant;
}

const CATEGORY_VARIANTS: Record<string, BadgeVariant> = {
  auth: "info",
  report: "success",
  report_template: "secondary",
  ai: "warning",
  study: "secondary",
  image: "secondary",
  pacs: "info",
  admin: "destructive",
  recording: "secondary",
};

export function actionLabel(action: string, locale?: Locale): string {
  return auditActionLabel(action, locale);
}

/** Derives a category from the action's event ID prefix (e.g. "report.sign" -> Rapor). */
export function actionCategory(action: string, locale?: Locale): CategoryMeta {
  const prefix = action.startsWith("report_template") ? "report_template" : action.split(".")[0];
  return {
    label: auditCategoryLabel(prefix, locale),
    variant: CATEGORY_VARIANTS[prefix] ?? "muted",
  };
}
