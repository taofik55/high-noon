import { Color, Vector3 } from "three";
import type { PartList } from "../core/parts";
import { extrude, mat, polygon } from "../core/shapes";
import { ringPoint, sweep, type Ring } from "../core/sweep";
import { BONE, rest } from "./skeleton";
import { skirtSkin, smooth, torsoSkin, vertexPositions } from "./skin";
import type { CharacterSpec } from "./spec";

// Outer garments other than the long coats in body.ts: poncho, dress, fringe trim and chaps.

const v3 = (x: number, y: number, z: number) => new Vector3(x, y, z);
const FWD = v3(0, 0, 1);

/** Poncho: a wide woven cloak over the shoulders, striped in the accent colour (El Gringo). */
export function buildPoncho(parts: PartList, spec: CharacterSpec): void {
  const k = spec.bulk;
  const poncho = sweep({
    path: [v3(0, 0.8, -0.01), v3(0, 1.0, -0.01), v3(0, 1.22, -0.01), v3(0, 1.38, -0.012), v3(0, 1.45, -0.016), v3(0, 1.5, -0.02)],
    rings: [
      { w: 0.29 * k, f: 0.14 * k, b: 0.14 * k, p: 3 },
      { w: 0.29 * k, f: 0.138 * k, b: 0.138 * k, p: 3 },
      { w: 0.285 * k, f: 0.135 * k, b: 0.135 * k, p: 3 },
      { w: 0.27 * k, f: 0.128 * k, b: 0.128 * k, p: 2.8 },
      { w: 0.17 * k, f: 0.11 * k, b: 0.11 * k, p: 2.2 },
      { w: 0.085, f: 0.075, b: 0.08 },
    ],
    front: FWD,
    radial: 40,
    samples: 24,
    deform: (p, u, a) => {
      // Vertical folds that deepen toward the hem, and points front and back (a square cloth over the shoulders).
      const fold = 0.014 * (1 - u) * Math.sin(a * 10);
      p.x += Math.cos(a) * fold;
      p.z += Math.sin(a) * fold;
      if (u < 0.3) p.y -= 0.08 * (1 - u / 0.3) * Math.abs(Math.sin(a)) ** 3;
    },
  });
  const pos = poncho.geometry.getAttribute("position");
  const base = new Color(spec.palette.coat);
  const stripe = new Color(spec.palette.accent);
  const at = vertexPositions(poncho.geometry);
  parts.add(poncho.geometry, {
    material: "cloth",
    color: base,
    // Woven bands: an accent stripe every third band.
    colorAt: (v, _b, out) => {
      const i = Math.floor((pos.getY(v) - 0.84) / 0.075);
      out.copy(i % 3 === 0 ? stripe : base);
    },
    skin: (v) => {
      const p = at(v);
      // Above the arms it follows the chest; low down it hangs from the spine, not the legs.
      return p.y > 1.2 ? torsoSkin(p.y) : { bones: [BONE.Spine, BONE.Hips], weights: [0.7, 0.3] };
    },
  });
}

/** Dress: a flared skirt with a ruffled hem and a sash at the waist (Suzy Lafayette). */
export function buildDress(parts: PartList, spec: CharacterSpec): void {
  const skirt = sweep({
    path: [v3(0, 0.06, -0.01), v3(0, 0.35, -0.01), v3(0, 0.7, -0.005), v3(0, 0.95, 0), v3(0, 1.05, -0.005)],
    rings: [
      { w: 0.34, f: 0.32, b: 0.34 },
      { w: 0.3, f: 0.27, b: 0.3 },
      { w: 0.22, f: 0.18, b: 0.21 },
      { w: 0.178, f: 0.118, b: 0.13 },
      { w: 0.15, f: 0.1, b: 0.106 },
    ],
    front: FWD,
    radial: 36,
    samples: 16,
    deform: (p, u, a) => {
      // Folds running down the skirt, deeper toward the hem.
      const fold = 0.012 * (1 - u) * Math.sin(a * 12);
      p.x += Math.cos(a) * fold;
      p.z += Math.sin(a) * fold;
    },
  });
  const at = vertexPositions(skirt.geometry);
  parts.add(skirt.geometry, { material: "cloth", color: spec.palette.coat, skin: (v) => skirtSkin(at(v)) });
  // Ruffle: a short wavy band at the hem in the accent colour.
  const ruffle = sweep({
    path: [v3(0, 0.03, -0.01), v3(0, 0.11, -0.01)],
    rings: [
      { w: 0.36, f: 0.34, b: 0.36 },
      { w: 0.335, f: 0.315, b: 0.335 },
    ],
    front: FWD,
    radial: 48,
    deform: (p, _u, a) => {
      const wave = 0.012 * Math.sin(a * 24);
      p.x += Math.cos(a) * wave;
      p.z += Math.sin(a) * wave;
    },
  });
  const rat = vertexPositions(ruffle.geometry);
  parts.add(ruffle.geometry, { material: "cloth", color: spec.palette.accent, skin: (v) => skirtSkin(rat(v)) });
  const sash = sweep({
    path: [v3(0, 1.0, -0.005), v3(0, 1.06, -0.008)],
    rings: [
      { w: 0.174, f: 0.116, b: 0.13 },
      { w: 0.162, f: 0.106, b: 0.114 },
    ],
    front: FWD,
    radial: 24,
  });
  parts.add(sash.geometry, { material: "cloth", color: spec.palette.accent, bone: BONE.Spine });
}

/** Buckskin fringe along a short jacket's hem and the back seam of each sleeve (Kit Carlson, Calamity Janet). */
export function buildFringe(parts: PartList, spec: CharacterSpec, hemRing: Ring, hem: number): void {
  const strip = extrude(polygon([[-0.004, 0], [0.004, 0], [0.0025, -0.075], [-0.0025, -0.075]]), 0.003);
  const color = new Color(spec.palette.coat).multiplyScalar(0.92);
  const gap = hemRing.gap ?? 0;
  const count = 34;
  for (let i = 0; i < count; i++) {
    const a = Math.PI / 2 + gap + ((Math.PI * 2 - 2 * gap) * (i + 0.5)) / count;
    const [x, z] = ringPoint(hemRing, a);
    const p = v3(x, hem + 0.005, z - 0.01);
    parts.add(strip, {
      material: "leather",
      color,
      skin: () => skirtSkin(p),
      // Face outward from the body, hanging straight down.
      matrix: mat([p.x, p.y, p.z], [0, Math.atan2(p.x, p.z), (i % 3) * 0.06 - 0.06]),
    });
  }
  for (const side of [1, -1] as const) {
    const shoulder = rest(side === 1 ? "LeftArm" : "RightArm");
    const elbow = rest(side === 1 ? "LeftForeArm" : "RightForeArm");
    for (let i = 0; i < 9; i++) {
      const t = 0.15 + (i / 8) * 0.8;
      const p = shoulder.clone().lerp(elbow, t).add(v3(0.045 * side, 0, -0.035));
      parts.add(strip, {
        material: "leather",
        color,
        bone: side === 1 ? BONE.LeftArm : BONE.RightArm,
        matrix: mat([p.x, p.y, p.z], [0, side * (Math.PI / 2 + 0.6), side * 0.9], [1, 0.6, 1]),
      });
    }
  }
}

/** Leather chaps over each leg, open at the back, with a belt across the front (Paul Regret). */
export function buildChaps(parts: PartList, spec: CharacterSpec): void {
  const k = spec.bulk;
  const leather = new Color(spec.palette.boots).lerp(new Color("#8a5a32"), 0.5);
  for (const side of [1, -1] as const) {
    const x = 0.094 * side;
    const sideName = side === 1 ? "Left" : "Right";
    const chap = sweep({
      path: [v3(x * 0.95, 0.96, 0.0), v3(x, 0.76, 0.012), v3(x * 1.03, 0.51, 0.022), v3(x * 1.05, 0.38, 0.0)],
      rings: [
        { w: 0.098 * k, f: 0.095 * k, b: 0.1 * k, gap: 0.9 },
        { w: 0.084 * k, f: 0.086 * k, b: 0.084 * k, gap: 0.8 },
        { w: 0.068 * k, f: 0.072 * k, b: 0.064 * k, gap: 0.8 },
        { w: 0.074 * k, f: 0.068 * k, b: 0.08 * k, gap: 0.9 },
      ],
      // The ring's "front" points backward, so the opening is at the back of the leg.
      front: v3(0, 0, -1),
      radial: 14,
      samples: 12,
    });
    const along = chap.along;
    parts.add(chap.geometry, {
      material: "leather",
      color: leather,
      skin: (v) => {
        const u = along[v] ?? 0;
        const w = smooth(0.45, 0.6, u);
        return { bones: [BONE[`${sideName}UpLeg`], BONE[`${sideName}Leg`]], weights: [1 - w, w] };
      },
    });
  }
}
