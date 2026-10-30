import { en, type MessageKey } from "./en";
import { id } from "./id";

export type Locale = "id" | "en";
export type { MessageKey };

export const DEFAULT_LOCALE: Locale = "id";

const dictionaries: Record<Locale, Partial<Record<MessageKey, string>>> = { id, en };

export type MessageParams = Record<string, string | number>;

/** Looks up a message (English fallback) and fills `{name}` placeholders from `params`. */
export function t(key: MessageKey, params?: MessageParams, locale: Locale = DEFAULT_LOCALE): string {
  const template = dictionaries[locale][key] ?? en[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}
