import { Color, Vector3 } from "three";
import type { PartList } from "../core/parts";
import { lathe, mat } from "../core/shapes";
import { sweep } from "../core/sweep";
import { BONE } from "./skeleton";
import { smooth } from "./skin";
import type { CharacterSpec } from "./spec";

/**
 * Cattleman hat: a lathed crown pinched at the front with a long centre crease, an oval brim with thickness that
 * curls up at the sides and dips at the front, a band and a concho. Rigid on the Head bone.
 */
export function buildHat(parts: PartList, spec: CharacterSpec): void {
  const h = spec.hat;
  const base = new Vector3(0, 1.738, -0.008);
  const tilt = mat([base.x, base.y, base.z], [-0.07, 0, 0]);
  const color = spec.palette.hat;

  // Crown: profile from the band up, slightly tapered; oval footprint.
  const ch = h.crown;
  const crown = lathe(
    [
      [0.093, 0],
      [0.094, ch * 0.25],
      [0.092, ch * 0.55],
      [0.087, ch * 0.8],
      [0.077, ch * 0.95],
      [0.055, ch * 1.02],
      [0.0, ch * 0.98],
    ],
    40,
  );
  const cp = crown.getAttribute("position");
  for (let i = 0; i < cp.count; i++) {
    let x = cp.getX(i) * 0.93;
    let y = cp.getY(i);
    const z = cp.getZ(i) * 1.1;
    const top = smooth(ch * 0.55, ch, y);
    // Centre crease front to back, deeper toward the front.
    y -= h.crease * top * Math.exp(-((x / 0.028) ** 2)) * (0.75 + 0.25 * smooth(-0.1, 0.1, z));
    // Front pinch: the two dents either side of the front.
    const front = smooth(0.0, 0.08, z);
    x *= 1 - 0.22 * front * smooth(ch * 0.35, ch * 0.9, y);
    cp.setXYZ(i, x, y, z);
  }
  crown.computeVertexNormals();
  parts.add(crown, { material: "cloth", color, bone: BONE.Head, matrix: tilt });

  // Brim: a lathed closed profile (top surface out, rolled edge, underside back in).
  const r0 = 0.09;
  const r1 = h.brim;
  const brim = lathe(
    [
      [r0, -0.004],
      [r1 - 0.008, -0.004],
      [r1, -0.0015],
      [r1 + 0.001, 0.002],
      [r1 - 0.006, 0.004],
      [r0, 0.003],
    ],
    48,
  );
  const bp = brim.getAttribute("position");
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i) * 0.95;
    const z = bp.getZ(i) * 1.1;
    const r = Math.hypot(bp.getX(i), bp.getZ(i));
    const out = smooth(r0, r1, r);
    const ang = Math.atan2(z, x);
    // Sides roll up; front and back dip slightly.
    const side = Math.abs(Math.cos(ang)) ** 2.2;
    const y = bp.getY(i) + h.curl * out * out * side - 0.012 * out * (1 - side) * (z > 0 ? 1.2 : 0.6);
    bp.setXYZ(i, x, y, z);
  }
  brim.computeVertexNormals();
  parts.add(brim, { material: "cloth", color: new Color(color).multiplyScalar(0.96), bone: BONE.Head, matrix: tilt });

  // Band around the crown base, with a small concho on the left side.
  const band = sweep({
    path: Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      return new Vector3(Math.cos(a) * 0.0945 * 0.93, 0.013, Math.sin(a) * 0.0945 * 1.1);
    }),
    rings: Array.from({ length: 24 }, () => ({ w: 0.0025, f: 0.0095, b: 0.0095, p: 4 })),
    front: new Vector3(0, 1, 0),
    radial: 6,
    closed: true,
  });
  parts.add(band.geometry, { material: "leather", color: spec.palette.hatBand, bone: BONE.Head, matrix: tilt });
  const concho = lathe([[0, 0], [0.009, 0.0005], [0.01, 0.002], [0.007, 0.0035], [0, 0.004]], 12);
  parts.add(concho, { material: "brass", color: spec.palette.metal, bone: BONE.Head, matrix: tilt.clone().multiply(mat([0.088, 0.013, 0.02], [0, 0, -Math.PI / 2])) });
}
