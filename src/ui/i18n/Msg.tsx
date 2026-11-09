"use client";

import { t, type MessageKey } from "./index";

/** A translated string in a server component's output: rendered on the client, so it follows the chosen language. */
export function Msg({ k }: { k: MessageKey }) {
  return <>{t(k)}</>;
}
