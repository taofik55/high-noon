import type { SkinFn } from "../core/parts";

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Weights for a sweep that runs through a chain of bones (hip → knee → ankle): each bone owns the part of the sweep
 * from its `from` value on, and neighbouring bones blend over `blend` around each joint so joints bend smoothly.
 */
export function chainSkin(along: Float32Array, chain: readonly { bone: number; from: number }[], blend = 0.07): SkinFn {
  return (v) => {
    const u = along[v] ?? 0;
    let i = 0;
    while (i + 1 < chain.length && u >= (chain[i + 1]?.from ?? 2) - blend) i++;
    const cur = chain[i] as { bone: number; from: number };
    const prevLink = chain[i - 1];
    // Blend with the previous bone just after this bone's joint.
    if (prevLink && u < cur.from + blend) {
      const w = smooth(cur.from - blend, cur.from + blend, u);
      return { bones: [cur.bone, prevLink.bone], weights: [w, 1 - w] };
    }
    return { bones: [cur.bone], weights: [1] };
  };
}

export { smooth };
