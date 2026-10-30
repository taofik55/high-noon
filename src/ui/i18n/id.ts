import type { MessageKey } from "./en";

// Partial on purpose: any missing key falls back to English (CLAUDE.md code style).
export const id: Partial<Record<MessageKey, string>> = {
  "home.tagline": "Adu tembak di Wild West bersama teman-temanmu.",
  "home.comingSoon": "Sedang dibangun. Sheriff masih membersihkan revolvernya.",
};
