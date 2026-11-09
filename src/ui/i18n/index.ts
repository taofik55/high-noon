import { en, type MessageKey } from "./en";
import { id } from "./id";

export type Locale = "id" | "en";
export type { MessageKey };

export const DEFAULT_LOCALE: Locale = "id";

const dictionaries: Record<Locale, Partial<Record<MessageKey, string>>> = { id, en };

export type MessageParams = Record<string, string | number>;

export const LOCALES: readonly Locale[] = ["id", "en"];

/**
 * The language the UI renders in. The server always renders DEFAULT_LOCALE; on the client SettingsRoot switches to
 * the player's choice after hydration (and re-renders the app under it).
 */
let active: Locale = DEFAULT_LOCALE;

export function setActiveLocale(locale: Locale): void {
  active = locale;
}

export function activeLocale(): Locale {
  return active;
}

/** Looks up a message (English fallback) and fills `{name}` placeholders from `params`. */
export function t(key: MessageKey, params?: MessageParams, locale: Locale = active): string {
  const template = dictionaries[locale][key] ?? en[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}
