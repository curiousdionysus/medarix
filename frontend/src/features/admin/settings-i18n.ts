import { translateForLocale, type Locale } from "@/features/i18n/locale-context";

function sk(key: string) {
  return key.replace(/\./g, "_");
}

function field(path: string, locale: Locale): string | undefined {
  const v = translateForLocale(locale, path);
  return v !== path ? v : undefined;
}

export function settingLabel(key: string, locale: Locale, fallback: string): string {
  return field(`systemSettings.${sk(key)}.label`, locale) ?? fallback;
}

export function settingDescription(
  key: string,
  locale: Locale,
  fallback: string | null | undefined,
): string | undefined {
  if (!fallback) return undefined;
  return field(`systemSettings.${sk(key)}.desc`, locale) ?? fallback;
}

const CATEGORY_KEYS: Record<string, string> = {
  "Yapay Zeka Servisleri": "admin.settingsCatAi",
  "PACS / DICOM": "admin.settingsCatPacs",
  "Kimlik Doğrulama": "admin.settingsCatAuth",
  Güvenlik: "admin.settingsCatSecurity",
  "Veri Saklama": "admin.settingsCatStorage",
  "Kurumsal Kimlik": "branding.orgTitles",
};

export function settingsCategoryLabel(category: string, locale: Locale): string {
  const key = CATEGORY_KEYS[category];
  if (!key) return category;
  const v = translateForLocale(locale, key);
  return v !== key ? v : category;
}

const LDAP_CHECK_KEYS: Record<string, string> = {
  bind: "ldapVerify.checkBind",
  search_base: "ldapVerify.checkSearchBase",
  user_filter: "ldapVerify.checkUserFilter",
  user_login: "ldapVerify.checkUserLogin",
};

export function ldapCheckLabel(id: string, locale: Locale, fallback: string): string {
  const key = LDAP_CHECK_KEYS[id];
  if (!key) return fallback;
  const v = translateForLocale(locale, key);
  return v !== key ? v : fallback;
}

/** Map Turkish API verify messages to the active locale. */
export function ldapVerifyMessage(
  result: { ok: boolean; mode?: string; message: string },
  locale: Locale,
): string {
  if (result.mode === "local") return translateForLocale(locale, "ldapVerify.localOk");
  const msg = result.message;
  if (msg.includes("Eksik alanlar:")) {
    const tail = msg.replace(/^Eksik alanlar:\s*/, "");
    return `${translateForLocale(locale, "ldapVerify.missingFields")}: ${tail}`;
  }
  if (msg.includes("servis hesabı ile bağlanılamadı")) return translateForLocale(locale, "ldapVerify.bindFailed");
  if (msg.includes("arama tabanı") && msg.includes("doğrulanamadı"))
    return translateForLocale(locale, "ldapVerify.searchBaseFailed");
  if (msg.includes("filtresi geçersiz")) return translateForLocale(locale, "ldapVerify.filterInvalid");
  if (msg.includes("parola girin")) return translateForLocale(locale, "ldapVerify.testPasswordRequired");
  if (msg.includes("giriş doğrulanamadı")) return translateForLocale(locale, "ldapVerify.testLoginFailed");
  if (msg.includes("girişi başarılı")) {
    const m = msg.match(/'([^']+)'/);
    return translateForLocale(locale, "ldapVerify.successWithUser").replace("{user}", m?.[1] ?? "");
  }
  if (msg.includes("Tam giriş testi")) return translateForLocale(locale, "ldapVerify.configOkOptionalTest");
  if (msg.includes("doğrulandı")) return translateForLocale(locale, "ldapVerify.configOk");
  return msg;
}
