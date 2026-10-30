import { CHARACTER_IDS } from "@/engine";

export type AssetKind = "character" | "animations" | "prop" | "building" | "card-art";

/** Primitive stand-ins that every real asset falls back to (docs/05 §11, Golden rule 6). */
export type PlaceholderId =
  | "placeholder.capsule"
  | "placeholder.cylinder"
  | "placeholder.box"
  | "placeholder.horse"
  | "placeholder.none";

export interface AssetEntry {
  /** null until the real file exists in public/assets (Phase 12). */
  url: string | null;
  kind: AssetKind;
  fallback: PlaceholderId;
  credit?: string;
}

const characters = Object.fromEntries(
  CHARACTER_IDS.map((id) => [`char.${id}`, { url: null, kind: "character", fallback: "placeholder.capsule" } satisfies AssetEntry]),
);

/**
 * docs/07 §4 manifest. Placeholders use the same ids as the real assets, so swapping in a GLB later is a data-only
 * change: set `url` (and a credit) here.
 */
export const ASSETS: Readonly<Record<string, AssetEntry>> = {
  ...characters,
  "anim.shared": { url: null, kind: "animations", fallback: "placeholder.none" },
  "prop.barrel": { url: null, kind: "prop", fallback: "placeholder.cylinder" },
  "prop.crate": { url: null, kind: "prop", fallback: "placeholder.box" },
  "prop.wagon": { url: null, kind: "prop", fallback: "placeholder.box" },
  "prop.horse": { url: null, kind: "prop", fallback: "placeholder.horse" },
  "prop.cactus": { url: null, kind: "prop", fallback: "placeholder.cylinder" },
  "building.saloon": { url: null, kind: "building", fallback: "placeholder.box" },
  "building.sheriff": { url: null, kind: "building", fallback: "placeholder.box" },
  "building.bank": { url: null, kind: "building", fallback: "placeholder.box" },
  "building.store": { url: null, kind: "building", fallback: "placeholder.box" },
  "building.stable": { url: null, kind: "building", fallback: "placeholder.box" },
  "building.undertaker": { url: null, kind: "building", fallback: "placeholder.box" },
  "building.water_tower": { url: null, kind: "building", fallback: "placeholder.box" },
  "building.stagecoach_stop": { url: null, kind: "building", fallback: "placeholder.box" },
  "cards.art": { url: null, kind: "card-art", fallback: "placeholder.none" },
};

export type ResolvedAsset = { source: "gltf"; url: string } | { source: "placeholder"; placeholder: PlaceholderId };

/** What to render for an asset id: the real file if available, otherwise its placeholder. Unknown ids → none. */
export function resolveAsset(id: string): ResolvedAsset {
  const entry = ASSETS[id];
  if (!entry) return { source: "placeholder", placeholder: "placeholder.none" };
  return entry.url ? { source: "gltf", url: entry.url } : { source: "placeholder", placeholder: entry.fallback };
}
