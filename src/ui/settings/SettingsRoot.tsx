"use client";

import { Fragment, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { reducedMotion, useSettings } from "@/game3d/settings/settingsStore";
import { DEFAULT_LOCALE, setActiveLocale } from "../i18n";
import { DISPLAY_CHANGED } from "./events";

const noop = () => () => {};

/**
 * Applies the player's display settings to the whole app: language, large text and reduced motion. The server (and
 * hydration) always render the default language; right after hydration the app re-renders in the chosen one, keyed
 * by locale so every component picks up the new strings. Changing the language later re-renders the app the same way
 * (a solo game in progress is saved and resumes; online games resync).
 */
export function SettingsRoot({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const chosen = useSettings((s) => s.locale);
  const locale = hydrated ? chosen : DEFAULT_LOCALE;
  // Set before the children render, so their t() calls use it.
  setActiveLocale(locale);

  const largeText = useSettings((s) => s.largeText);
  const motion = useSettings((s) => s.reduceMotion);
  const fourColor = useSettings((s) => s.colorBlindSuits);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    document.documentElement.classList.toggle("large-text", largeText);
  }, [largeText]);
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reducedMotion());
  }, [motion]);
  // Card faces carry rules text and suit colours in their textures; the 3D layer redraws them (cardTexture.ts)
  // without the root layout importing three.js.
  useEffect(() => {
    window.dispatchEvent(new Event(DISPLAY_CHANGED));
  }, [locale, fourColor]);

  return <Fragment key={locale}>{children}</Fragment>;
}
