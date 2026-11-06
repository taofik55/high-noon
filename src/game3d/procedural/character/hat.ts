import { Color, Shape, Vector3 } from "three";
import type { PartList } from "../core/parts";
import { extrude, lathe, mat } from "../core/shapes";
import { sweep } from "../core/sweep";
import { BONE } from "./skeleton";
import { smooth } from "./skin";
import type { CharacterSpec, HatStyle } from "./spec";

/**
 * Hats: a lathed crown (profile per style, optionally creased and pinched), a brim lathed from a closed profile so it
 * has thickness and a rolled edge, then curled per style, a band and trim. Rigid on the Head bone.
 */

type Profile = [number, number][];

function crownProfile(style: HatStyle, ch: number): Profile {
  switch (style) {
    case "flat":
      return [[0.093, 0], [0.094, ch * 0.5], [0.092, ch * 0.92], [0.086, ch], [0, ch]];
    case "sombrero":
      return [[0.095, 0], [0.088, ch * 0.3], [0.074, ch * 0.65], [0.054, ch * 0.92], [0.03, ch * 1.0], [0, ch * 0.98]];
    case "top":
    case "stovepipe":
      return [[0.091, 0], [0.091, ch * 0.4], [0.095, ch * 0.96], [0.093, ch], [0, ch]];
    case "derby":
    case "feather":
      return [[0.092, 0], [0.094, ch * 0.35], [0.09, ch * 0.65], [0.073, ch * 0.86], [0.042, ch * 0.98], [0, ch]];
    case "slouch":
      return [[0.094, 0], [0.096, ch * 0.45], [0.087, ch * 0.8], [0.055, ch], [0, ch * 0.94]];
    default:
      return [[0.093, 0], [0.094, ch * 0.25], [0.092, ch * 0.55], [0.087, ch * 0.8], [0.077, ch * 0.95], [0.055, ch * 1.02], [0, ch * 0.98]];
  }
}

export function buildHat(parts: PartList, spec: CharacterSpec): void {
  const h = spec.hat;
  const style = h.style;
  const base = new Vector3(0, 1.738, -0.008);
  // Most hats sit level with a slight forward tip; the feathered lady's hat is worn at a jaunty angle.
  const tilt = style === "feather" ? mat([0.02, base.y + 0.01, base.z], [-0.12, 0, -0.22], 0.82) : mat([base.x, base.y, base.z], [-0.07, 0, 0]);
  const color = spec.palette.hat;
  const creased = style === "cattleman" || style === "slouch";

  const ch = h.crown;
  const crown = lathe(crownProfile(style, ch), 40);
  const cp = crown.getAttribute("position");
  for (let i = 0; i < cp.count; i++) {
    let x = cp.getX(i) * 0.93;
    let y = cp.getY(i);
    const z = cp.getZ(i) * 1.1;
    if (creased) {
      const top = smooth(ch * 0.55, ch, y);
      y -= h.crease * top * Math.exp(-((x / 0.028) ** 2)) * (0.75 + 0.25 * smooth(-0.1, 0.1, z));
      const front = smooth(0.0, 0.08, z);
      x *= 1 - 0.22 * front * smooth(ch * 0.35, ch * 0.9, y);
    }
    cp.setXYZ(i, x, y, z);
  }
  crown.computeVertexNormals();
  parts.add(crown, { material: "cloth", color, bone: BONE.Head, matrix: tilt });

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
    style === "sombrero" ? 56 : 48,
  );
  const bp = brim.getAttribute("position");
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i) * 0.95;
    const z = bp.getZ(i) * (style === "sombrero" ? 1 : 1.1);
    const r = Math.hypot(bp.getX(i), bp.getZ(i));
    const out = smooth(r0, r1, r);
    const ang = Math.atan2(z, x);
    const side = Math.abs(Math.cos(ang)) ** 2.2;
    let y = bp.getY(i);
    if (style === "sombrero") {
      // A wide brim that rises in a rolled lip all the way round.
      y += 0.05 * smooth(0.7, 1, out) ** 2 - 0.012 * out;
    } else {
      y += h.curl * out * out * side - 0.012 * out * (1 - side) * (z > 0 ? 1.2 : 0.6);
    }
    bp.setXYZ(i, x, y, z);
  }
  brim.computeVertexNormals();
  parts.add(brim, { material: "cloth", color: new Color(color).multiplyScalar(0.96), bone: BONE.Head, matrix: tilt });

  // Band around the crown base.
  const bandColor = style === "sombrero" || style === "feather" ? spec.palette.accent : spec.palette.hatBand;
  const bandH = style === "top" || style === "stovepipe" ? 0.016 : 0.0095;
  const band = sweep({
    path: Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      return new Vector3(Math.cos(a) * 0.0945 * 0.93, 0.004 + bandH, Math.sin(a) * 0.0945 * 1.1);
    }),
    rings: Array.from({ length: 24 }, () => ({ w: 0.0025, f: bandH, b: bandH, p: 4 })),
    front: new Vector3(0, 1, 0),
    radial: 6,
    closed: true,
  });
  parts.add(band.geometry, { material: "leather", color: bandColor, bone: BONE.Head, matrix: tilt });

  if (style === "cattleman" || style === "slouch") {
    const concho = lathe([[0, 0], [0.009, 0.0005], [0.01, 0.002], [0.007, 0.0035], [0, 0.004]], 12);
    parts.add(concho, { material: "brass", color: spec.palette.metal, bone: BONE.Head, matrix: tilt.clone().multiply(mat([0.088, 0.013, 0.02], [0, 0, -Math.PI / 2])) });
  }
  if (style === "feather" || spec.signature.includes("feather")) {
    // A curved plume tucked into the band, sweeping back.
    const plume = new Shape();
    plume.moveTo(0, 0);
    plume.bezierCurveTo(0.03, 0.04, 0.05, 0.12, 0.02, 0.2);
    plume.bezierCurveTo(0.0, 0.14, -0.012, 0.06, 0, 0);
    const vulture = spec.signature.includes("feather") && style !== "feather";
    parts.add(extrude(plume, 0.004, { size: 0.0015 }, 10), {
      material: "hair",
      color: vulture ? "#141210" : spec.palette.accent,
      bone: BONE.Head,
      matrix: tilt.clone().multiply(mat([0.085, 0.015, -0.02], [0.2, -Math.PI / 2 + 0.3, -0.5])),
    });
  }
}
