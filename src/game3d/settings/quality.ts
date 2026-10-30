export type Quality = "low" | "medium" | "high" | "ultra";
export type QualitySetting = Quality | "auto";

export const QUALITIES: readonly Quality[] = ["low", "medium", "high", "ultra"];

export interface QualityConfig {
  /** Canvas device-pixel-ratio range. */
  dpr: [number, number];
  shadows: boolean;
  shadowMapSize: number;
  antialias: boolean;
}

/** docs/05 §8 (post-processing arrives in Phase 13). */
export const QUALITY_CONFIG: Readonly<Record<Quality, QualityConfig>> = {
  low: { dpr: [1, 1], shadows: false, shadowMapSize: 512, antialias: false },
  medium: { dpr: [1, 1.25], shadows: true, shadowMapSize: 1024, antialias: true },
  high: { dpr: [1, 1.5], shadows: true, shadowMapSize: 2048, antialias: true },
  ultra: { dpr: [1, 2], shadows: true, shadowMapSize: 4096, antialias: true },
};

/** "auto" starts here and steps down while the frame rate is too low (PerformanceMonitor). */
export const AUTO_START: Quality = "high";

export function stepDown(q: Quality): Quality {
  const i = QUALITIES.indexOf(q);
  return QUALITIES[Math.max(0, i - 1)] ?? "low";
}

export function resolveQuality(setting: QualitySetting, autoLevel: Quality): Quality {
  return setting === "auto" ? autoLevel : setting;
}
