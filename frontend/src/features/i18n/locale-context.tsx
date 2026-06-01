import * as React from "react";
import { storage } from "@/lib/api";
import { en as enMessages } from "@/features/i18n/locales/en";
import { tr } from "@/features/i18n/locales/tr";

export type Locale = "tr" | "en";

type Messages = typeof tr;

const LOCALES: Record<Locale, Messages> = { tr, en: enMessages as unknown as Messages };

function readStoredLocale(): Locale {
  const raw = storage.get("language");
  return raw === "en" ? "en" : "tr";
}

function lookup(dict: Messages, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = dict;
  for (const part of parts) {
    if (!cur || typeof cur !== "object" || !(part in cur)) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string>) => string;
}

const LocaleContext = React.createContext<LocaleState | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>(readStoredLocale);

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next);
    storage.set("language", next);
    document.documentElement.lang = next;
  }, []);

  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = React.useCallback(
    (key: string, vars?: Record<string, string>) => {
      let text = lookup(LOCALES[locale], key) ?? lookup(LOCALES.tr, key) ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replaceAll(`{${k}}`, v);
        }
      }
      return text;
    },
    [locale],
  );

  const value = React.useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = React.useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

export function useT() {
  return useLocale().t;
}

/** Non-React helpers (e.g. roleLabel) */
export function translateForLocale(locale: Locale, key: string): string {
  return lookup(LOCALES[locale], key) ?? lookup(LOCALES.tr, key) ?? key;
}

export function getStoredLocale(): Locale {
  return readStoredLocale();
}
