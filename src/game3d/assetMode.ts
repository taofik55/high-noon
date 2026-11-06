/**
 * `?placeholders=1` shows the primitive placeholders instead of the procedural models (Golden rule 6: the game must
 * play the same either way). End-to-end interaction tests use it, because headless Chromium renders in software and
 * the full town is too slow there; one smoke test covers the procedural table itself.
 */
let cached: boolean | null = null;

export function placeholdersOnly(): boolean {
  if (cached !== null) return cached;
  cached = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("placeholders") === "1";
  return cached;
}
