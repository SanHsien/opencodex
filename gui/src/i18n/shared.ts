import { createContext, useContext } from "react";
import { DICTS, localeDisplayName, type Locale, type TKey } from "./catalogs";

export { DICTS, localeDisplayName, type Locale, type TKey };

export const LOCALES: { code: Locale; htmlLang: string }[] = [
  { code: "en", htmlLang: "en" },
  { code: "zh-TW", htmlLang: "zh-TW" },
];

const LANG_KEY = "ocx-lang";

let activeLocale: Locale | null = null;

export function detectInitial(): Locale {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === "en" || stored === "zh-TW") return stored;
    // Previously stored Simplified Chinese (or any other retired locale) → Traditional Chinese.
    if (stored === "zh") return "zh-TW";
  } catch { /* ignore */ }
  const nav = typeof navigator !== "undefined" && navigator?.language ? navigator.language.toLowerCase() : "en";
  if (nav.startsWith("zh")) return "zh-TW";
  return "en";
}

/** Current LanguageProvider locale for non-React UI such as the auth fetch dialog. */
export function getActiveLocale(): Locale {
  return activeLocale ?? detectInitial();
}

export function setActiveLocale(locale: Locale): void {
  activeLocale = locale;
}

export type Vars = Record<string, string | number>;
export type TFn = (key: TKey, vars?: Vars) => string;

export interface I18nContextValue { locale: Locale; setLocale: (l: Locale) => void; t: TFn }

export const I18nContext = createContext<I18nContextValue | null>(null);

export function interpolate(s: string, vars?: Vars): string {
  if (!vars) return s;
  let out = s;
  for (const k of Object.keys(vars)) out = out.split(`{${k}}`).join(String(vars[k]));
  return out;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within LanguageProvider");
  return ctx;
}

export function useT(): TFn {
  return useI18n().t;
}
