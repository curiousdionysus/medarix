/** Category-level enable toggles shown in Sistem Ayarları. */
export const CATEGORY_TOGGLE_KEY: Record<string, string> = {
  "Kimlik Doğrulama": "auth.ldap_enabled",
  "PACS / DICOM": "pacs.enabled",
  "Yapay Zeka Servisleri": "ai.enabled",
};

export const MODULE_TOGGLE_KEYS = new Set(Object.values(CATEGORY_TOGGLE_KEY));

export const AUTH_CATEGORY = "Kimlik Doğrulama";

export const AI_CATEGORY = "Yapay Zeka Servisleri";

export const QA_ENABLED_KEY = "qa.enabled";

export { BRANDING_CATEGORY } from "@/features/branding/types";

export const AI_TEXT_BASE_URL_KEY = "ai.text_base_url";
export const AI_TEXT_MODEL_KEY = "ai.text_model";
export const AI_TRANSCRIPTION_BASE_URL_KEY = "ai.transcription_base_url";
export const AI_TRANSCRIPTION_MODEL_KEY = "ai.transcription_model";

/** Sub-sections within the unified AI settings card. */
export const AI_SETTING_SECTIONS: { id: "transcription" | "llm" | "qa"; keys: string[] }[] = [
  {
    id: "transcription",
    keys: [
      "ai.transcription_base_url",
      "ai.transcription_model",
      "ai.transcription_language",
    ],
  },
  {
    id: "llm",
    keys: ["ai.text_base_url", "ai.text_model"],
  },
  {
    id: "qa",
    keys: [
      "qa.enabled",
      "qa.secondary_review_enabled",
      "qa.review_model",
      "qa.traceability_enabled",
    ],
  },
];

export const AI_SETTING_ORDER: string[] = AI_SETTING_SECTIONS.flatMap((s) => s.keys);

export const AI_SECTION_I18N: Record<
  (typeof AI_SETTING_SECTIONS)[number]["id"],
  { title: string; desc: string }
> = {
  transcription: {
    title: "settingsAiSectionTranscription",
    desc: "settingsAiSectionTranscriptionDesc",
  },
  llm: {
    title: "settingsAiSectionLlm",
    desc: "settingsAiSectionLlmDesc",
  },
  qa: {
    title: "settingsAiSectionQa",
    desc: "settingsAiSectionQaDesc",
  },
};

/** Boolean settings rendered as switches instead of text inputs. */
export const BOOL_SETTING_KEYS = new Set([
  "qa.enabled",
  "qa.secondary_review_enabled",
  "qa.traceability_enabled",
]);

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

export function sortAiSettings<T extends { key: string }>(settings: T[]): T[] {
  const order = new Map(AI_SETTING_ORDER.map((k, i) => [k, i]));
  return [...settings].sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99));
}
