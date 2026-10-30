// English is the fallback dictionary and the source of truth for message keys.
export const en = {
  "home.tagline": "A Wild West showdown with your friends.",
  "home.comingSoon": "Under construction. The sheriff is still cleaning his revolver.",
} as const;

export type MessageKey = keyof typeof en;
