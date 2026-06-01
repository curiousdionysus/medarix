import type { RoleSlug } from "@/types/api";
import { getStoredLocale, translateForLocale, type Locale } from "@/features/i18n/locale-context";

export function roleLabel(slug: RoleSlug | string, fallback?: string, locale?: Locale): string {
  const loc = locale ?? getStoredLocale();
  const key = `roles.${slug}`;
  const translated = translateForLocale(loc, key);
  if (translated !== key) return translated;
  return fallback ?? slug;
}
