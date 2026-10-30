import { en, type MessageKey } from "./en";
import { id } from "./id";

export type Locale = "id" | "en";
export type { MessageKey };

export const DEFAULT_LOCALE: Locale = "id";

const dictionaries: Record<Locale, Partial<Record<MessageKey, string>>> = { id, en };

export function t(key: MessageKey, locale: Locale = DEFAULT_LOCALE): string {
  return dictionaries[locale][key] ?? en[key];
}
