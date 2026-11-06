import { Vector3 } from "three";
import type { SkinFn } from "../core/parts";
import { BONE } from "./skeleton";

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

/** Torso skin: the spine chain by height. */
export function torsoSkin(y: number) {
  const chain: [number, number][] = [
    [0.0, BONE.Hips],
    [1.05, BONE.Spine],
    [1.17, BONE.Spine1],
    [1.29, BONE.Spine2],
    [1.49, BONE.Neck],
  ];
  let i = 0;
  while (i + 1 < chain.length && y >= (chain[i + 1] as [number, number])[0] - 0.04) i++;
  const [from, bone] = chain[i] as [number, number];
  const prev = chain[i - 1];
  if (prev && y < from + 0.04) {
    const w = smooth(from - 0.04, from + 0.04, y);
    return { bones: [bone, prev[1]], weights: [w, 1 - w] };
  }
  return { bones: [bone], weights: [1] };
}

/** Skirt of a long coat: follows the hips, and the thigh on its side as it hangs lower. */
export function skirtSkin(p: Vector3) {
  if (p.y > 0.97) return torsoSkin(p.y);
  const leg = p.x >= 0 ? BONE.LeftUpLeg : BONE.RightUpLeg;
  const w = 0.65 * smooth(0.02, 0.12, Math.abs(p.x)) * smooth(0.97, 0.6, p.y);
  return { bones: [BONE.Hips, leg], weights: [1 - w, w] };
}

export function vertexPositions(g: { getAttribute(n: string): { getX(i: number): number; getY(i: number): number; getZ(i: number): number; count: number } }) {
  const pos = g.getAttribute("position");
  return (v: number) => new Vector3(pos.getX(v), pos.getY(v), pos.getZ(v));
}

export { smooth };
