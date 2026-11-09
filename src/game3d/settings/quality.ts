export type Quality = "low" | "medium" | "high" | "ultra";
export type QualitySetting = Quality | "auto";

export const QUALITIES: readonly Quality[] = ["low", "medium", "high", "ultra"];

export interface QualityConfig {
  /** Canvas device-pixel-ratio range. */
  dpr: [number, number];
  shadows: boolean;
  shadowMapSize: number;
  antialias: boolean;
  /** Characters farther than this from the camera use LOD1 (docs/05 §8 "LOD bias"); 0 = always LOD1. */
  lodDistance: number;
  /** Curve detail of the static town (1 = full; see procedural/core/detail.ts). */
  townDetail: number;
}

/** docs/05 §8 (post-processing arrives in Phase 13). */
export const QUALITY_CONFIG: Readonly<Record<Quality, QualityConfig>> = {
  low: { dpr: [1, 1], shadows: false, shadowMapSize: 512, antialias: false, lodDistance: 0, townDetail: 0.5 },
  medium: { dpr: [1, 1.25], shadows: true, shadowMapSize: 1024, antialias: true, lodDistance: 13, townDetail: 1 },
  high: { dpr: [1, 1.5], shadows: true, shadowMapSize: 2048, antialias: true, lodDistance: 16, townDetail: 1 },
  ultra: { dpr: [1, 2], shadows: true, shadowMapSize: 4096, antialias: true, lodDistance: 24, townDetail: 1 },
};

/**
 * LOD for a character at `distance` from the camera, with 1.5 m of hysteresis around the switch distance so a
 * character standing near it does not flicker between levels.
 */
export function pickLod(current: 0 | 1, distance: number, lodDistance: number): 0 | 1 {
  if (lodDistance <= 0) return 1;
  if (current === 0) return distance > lodDistance + 0.75 ? 1 : 0;
  return distance < lodDistance - 0.75 ? 0 : 1;
}

/** "auto" starts here and steps down while the frame rate is too low (PerformanceMonitor). */
export const AUTO_START: Quality = "high";

export function stepDown(q: Quality): Quality {
  const i = QUALITIES.indexOf(q);
  return QUALITIES[Math.max(0, i - 1)] ?? "low";
}

export function resolveQuality(setting: QualitySetting, autoLevel: Quality): Quality {
  return setting === "auto" ? autoLevel : setting;
}
