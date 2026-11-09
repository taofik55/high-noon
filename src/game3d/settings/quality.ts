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
  /** Post-processing passes (docs/05 §7); `null` = render straight to the screen with renderer tone mapping. */
  post: PostConfig | null;
  /** Share of the ambient particles (dust motes, blown sand). */
  particles: number;
}

export interface PostConfig {
  /** MSAA samples of the composer's buffers (the canvas' own antialias does not apply through a composer). */
  multisampling: number;
  bloom: boolean;
  ssao: boolean;
  vignette: boolean;
  /** Depth of field, only while the Director runs a cinematic shot. */
  cinematicDof: boolean;
  grain: boolean;
}

/** docs/05 §8. */
export const QUALITY_CONFIG: Readonly<Record<Quality, QualityConfig>> = {
  low: { dpr: [1, 1], shadows: false, shadowMapSize: 512, antialias: false, lodDistance: 0, townDetail: 0.5, post: null, particles: 0.25 },
  medium: {
    dpr: [1, 1.25],
    shadows: true,
    shadowMapSize: 1024,
    antialias: true,
    lodDistance: 13,
    townDetail: 1,
    post: { multisampling: 4, bloom: true, ssao: false, vignette: false, cinematicDof: false, grain: false },
    particles: 0.5,
  },
  high: {
    dpr: [1, 1.5],
    shadows: true,
    shadowMapSize: 2048,
    antialias: true,
    lodDistance: 16,
    townDetail: 1,
    post: { multisampling: 4, bloom: true, ssao: true, vignette: true, cinematicDof: false, grain: false },
    particles: 1,
  },
  ultra: {
    // "device" pixel ratio: R3F clamps the upper bound to window.devicePixelRatio.
    dpr: [1, 3],
    shadows: true,
    shadowMapSize: 4096,
    antialias: true,
    lodDistance: 24,
    townDetail: 1,
    // MSAA 8 through the normal pass speckles SSAO edges; 4 is clean and the extra DPR does the rest.
    post: { multisampling: 4, bloom: true, ssao: true, vignette: true, cinematicDof: true, grain: true },
    particles: 1,
  },
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

/**
 * docs/05 §8 "auto": step down one level once the frame rate has stayed under 50 fps for 3 s. Frames longer than
 * half a second (a hidden tab, a GC pause, building the town) are ignored rather than counted as slow.
 */
export interface Governor {
  /** Seconds the frame rate has been continuously low. */
  slow: number;
  /** Seconds left before measuring again after a change (the new level needs time to settle). */
  settle: number;
  /** Smoothed fps. */
  fps: number;
}

export const AUTO_POLICY = { minFps: 50, slowFor: 3, settle: 2 } as const;

export function initialGovernor(): Governor {
  return { slow: 0, settle: AUTO_POLICY.settle, fps: 60 };
}

export function governorStep(g: Governor, dt: number): { next: Governor; stepDown: boolean } {
  if (dt <= 0 || dt > 0.5) return { next: g, stepDown: false };
  const fps = g.fps + (1 / dt - g.fps) * Math.min(1, dt * 4);
  if (g.settle > 0) return { next: { slow: 0, settle: Math.max(0, g.settle - dt), fps }, stepDown: false };
  const slow = fps < AUTO_POLICY.minFps ? g.slow + dt : 0;
  if (slow >= AUTO_POLICY.slowFor) return { next: { slow: 0, settle: AUTO_POLICY.settle, fps }, stepDown: true };
  return { next: { slow, settle: 0, fps }, stepDown: false };
}

/** "auto" starts here and steps down while the frame rate is too low. */
export const AUTO_START: Quality = "high";

export function stepDown(q: Quality): Quality {
  const i = QUALITIES.indexOf(q);
  return QUALITIES[Math.max(0, i - 1)] ?? "low";
}

export function resolveQuality(setting: QualitySetting, autoLevel: Quality, touch = false): Quality {
  // docs/05 §8: mobile forces low.
  if (touch) return "low";
  return setting === "auto" ? autoLevel : setting;
}

/** A phone or tablet: the primary pointer is a finger (no hover, coarse). */
export function touchDevice(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse) and (hover: none)").matches;
}
