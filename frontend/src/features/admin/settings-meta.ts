/** Category-level enable toggles shown in Sistem Ayarları. */
export const CATEGORY_TOGGLE_KEY: Record<string, string> = {
  "Kimlik Doğrulama": "auth.ldap_enabled",
  "PACS / DICOM": "pacs.enabled",
  "Yapay Zeka Servisleri": "ai.enabled",
};

export const MODULE_TOGGLE_KEYS = new Set(Object.values(CATEGORY_TOGGLE_KEY));

export const AUTH_CATEGORY = "Kimlik Doğrulama";

export const AI_CATEGORY = "Yapay Zeka Servisleri";

export const AI_TEXT_BASE_URL_KEY = "ai.text_base_url";
export const AI_TEXT_MODEL_KEY = "ai.text_model";
export const AI_TRANSCRIPTION_BASE_URL_KEY = "ai.transcription_base_url";
export const AI_TRANSCRIPTION_MODEL_KEY = "ai.transcription_model";

export const LDAP_SETTING_KEYS = [
  "auth.ldap_enabled",
  "auth.ldap_server_uri",
  "auth.ldap_bind_dn",
  "auth.ldap_bind_password",
  "auth.ldap_user_search_base",
  "auth.ldap_user_filter",
  "auth.ldap_group_attribute",
] as const;

export function isSettingEnabled(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}
