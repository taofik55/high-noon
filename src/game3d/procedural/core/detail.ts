/**
 * Level of detail for procedural builds (docs/05 §9: characters ≤ 25k tris, LOD1 ~8k). Builders keep asking for their
 * full-detail segment counts; while `withDetail` runs, sweeps, lathes and extrusions scale those counts down, so a
 * lower LOD is the same model with coarser curves (identical skinning, materials and silhouette).
 */
let scale = 1;

export function withDetail<T>(s: number, build: () => T): T {
  const prev = scale;
  scale = s;
  try {
    return build();
  } finally {
    scale = prev;
  }
}

/** A segment count at the current detail, never below `min`. */
export function seg(n: number, min = 3): number {
  return scale === 1 ? n : Math.max(min, Math.round(n * scale));
}
