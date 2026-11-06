import { Color, Shape } from "three";
import type { PartList } from "../core/parts";
import { extrude, lathe, mat, polygon, v3 } from "../core/shapes";
import { sweep, type Ring } from "../core/sweep";
import { BONE } from "./skeleton";
import { chainSkin, skirtSkin, torsoSkin, vertexPositions } from "./skin";
import { buildChaps, buildDress, buildFringe, buildPoncho } from "./outer";
import type { CharacterSpec } from "./spec";

// Clothing and limbs of the master cowboy, built in the rest pose (metres, facing +Z, left on +X).

const UP = v3(0, 1, 0);
const FWD = v3(0, 0, 1);
type Side = 1 | -1;
const L = (side: Side, left: number, right: number) => (side === 1 ? left : right);

export function buildLegs(parts: PartList, spec: CharacterSpec): void {
  const k = spec.bulk * (spec.body === "female" ? 1.04 : 1);
  // Seat of the trousers: one wide loft the legs grow out of.
  const pelvis = sweep({
    path: [v3(0, 0.86, 0.0), v3(0, 0.93, -0.005), v3(0, 1.01, 0)],
    rings: [
      { w: 0.13 * k, f: 0.085 * k, b: 0.1 * k },
      { w: 0.162 * k, f: 0.1 * k, b: 0.112 * k },
      { w: 0.158 * k, f: 0.1 * k, b: 0.104 * k },
    ],
    front: FWD,
    radial: 20,
    samples: 5,
  });
  // Under a dress only the boots show: no trousers to poke through the skirt.
  const trousers = spec.coat !== "dress";
  if (trousers) parts.add(pelvis.geometry, { material: "cloth", color: spec.palette.trousers, bone: BONE.Hips });

  for (const side of [1, -1] as Side[]) {
    const x = 0.094 * side;
    const leg = sweep({
      path: [v3(x * 0.92, 0.98, 0.0), v3(x, 0.76, 0.012), v3(x * 1.03, 0.51, 0.022), v3(x * 1.05, 0.38, 0.0), v3(x * 1.06, 0.3, -0.008)],
      rings: [
        { w: 0.088 * k, f: 0.085 * k, b: 0.095 * k },
        { w: 0.072 * k, f: 0.074 * k, b: 0.072 * k },
        { w: 0.054 * k, f: 0.058 * k, b: 0.05 * k },
        { w: 0.056 * k, f: 0.05 * k, b: 0.064 * k },
        { w: 0.05 * k, f: 0.046 * k, b: 0.052 * k },
      ],
      front: FWD,
      radial: 16,
      samples: 16,
      // A crease in front of the knee and a slight sag at the seat read as cloth, not a tube.
      deform: (p, u, a) => {
        const front = Math.max(0, Math.sin(a));
        p.z -= 0.006 * front * Math.exp(-(((u - 0.5) / 0.05) ** 2));
      },
    });
    const sideName = side === 1 ? "Left" : "Right";
    if (trousers) parts.add(leg.geometry, {
      material: "cloth",
      color: spec.palette.trousers,
      skin: chainSkin(leg.along, [
        { bone: BONE.Hips, from: 0 },
        { bone: BONE[`${sideName}UpLeg`], from: 0.08 },
        { bone: BONE[`${sideName}Leg`], from: 0.5 },
      ]),
    });
    buildBoot(parts, spec, side);
  }
  if (spec.chaps) buildChaps(parts, spec);
}

function buildBoot(parts: PartList, spec: CharacterSpec, side: Side): void {
  const x = 0.1 * side;
  const sideName = side === 1 ? "Left" : "Right";
  const leather = spec.palette.boots;
  const dark = new Color(leather).multiplyScalar(0.55);

  // Shaft: taller at front and back, dipped at the sides like a real cowboy boot top.
  const shaft = sweep({
    path: [v3(x, 0.09, -0.025), v3(x, 0.2, -0.02), v3(x, 0.33, -0.006), v3(x, 0.44, 0.002)],
    rings: [
      { w: 0.046, f: 0.05, b: 0.052 },
      { w: 0.047, f: 0.048, b: 0.056 },
      { w: 0.057, f: 0.058, b: 0.066 },
      { w: 0.066, f: 0.068, b: 0.074 },
    ],
    front: FWD,
    radial: 16,
    samples: 9,
    deform: (p, u, a) => {
      if (u > 0.85) p.y -= 0.014 * ((u - 0.85) / 0.15) * Math.abs(Math.cos(a)) ** 1.5;
    },
  });
  parts.add(shaft.geometry, {
    material: "leather",
    color: leather,
    skin: chainSkin(shaft.along, [
      { bone: BONE[`${sideName}Foot`], from: 0 },
      { bone: BONE[`${sideName}Leg`], from: 0.3 },
    ]),
  });
  // Pull straps at the top of the shaft.
  for (const zs of [1, -1]) {
    const strap = extrude(polygon([[-0.012, 0], [0.012, 0], [0.009, 0.035], [-0.009, 0.035]]), 0.004, { size: 0.001 });
    parts.add(strap, { material: "leather", color: dark, bone: BONE[`${sideName}Leg`], matrix: mat([x, 0.425, zs * 0.068], [zs * -0.15, 0, 0]) });
  }

  // Vamp: heel to pointed toe, lofted along the foot with the "front" of each ring facing up.
  const foot = sweep({
    path: [v3(x, 0.07, -0.065), v3(x, 0.072, 0.0), v3(x, 0.056, 0.08), v3(x * 0.98, 0.04, 0.16), v3(x * 0.96, 0.03, 0.215)],
    rings: [
      { w: 0.044, f: 0.045, b: 0.05 },
      { w: 0.048, f: 0.052, b: 0.055 },
      { w: 0.046, f: 0.04, b: 0.04 },
      { w: 0.032, f: 0.026, b: 0.028 },
      { w: 0.007, f: 0.008, b: 0.012 },
    ],
    front: UP,
    radial: 16,
    samples: 14,
    capEnd: true,
  });
  parts.add(foot.geometry, {
    material: "leather",
    color: leather,
    skin: chainSkin(foot.along, [
      { bone: BONE[`${sideName}Foot`], from: 0 },
      { bone: BONE[`${sideName}ToeBase`], from: 0.72 },
    ]),
  });

  // Sole: the footprint outline extruded, then a stacked Cuban heel.
  const print = new Shape();
  print.moveTo(-0.036, -0.06);
  print.quadraticCurveTo(0, -0.085, 0.036, -0.06);
  print.lineTo(0.04, 0.02);
  print.quadraticCurveTo(0.045, 0.12, 0.012, 0.215);
  print.quadraticCurveTo(0, 0.228, -0.012, 0.215);
  print.quadraticCurveTo(-0.045, 0.12, -0.04, 0.02);
  print.closePath();
  const sole = extrude(print, 0.012, { size: 0.002 });
  parts.add(sole, { material: "leather", color: dark, bone: BONE[`${sideName}Foot`], matrix: mat([x, 0.009, 0], [Math.PI / 2, 0, 0]) });
  const heel = extrude(polygon([[-0.032, -0.085], [0.032, -0.085], [0.027, -0.02], [-0.027, -0.02]]), 0.035, { size: 0.002 });
  parts.add(heel, { material: "leather", color: dark, bone: BONE[`${sideName}Foot`], matrix: mat([x, 0.0195, -0.004], [Math.PI / 2, 0, 0]) });

  // Spur: a strap around the heel and a star rowel.
  const band = sweep({
    path: Array.from({ length: 9 }, (_, i) => {
      const t = (i / 8) * Math.PI;
      return v3(x + Math.cos(t) * 0.047, 0.075, -0.035 - Math.sin(t) * 0.04);
    }),
    rings: Array.from({ length: 9 }, () => ({ w: 0.006, f: 0.003, b: 0.003 })),
    front: UP,
    radial: 6,
  });
  parts.add(band.geometry, { material: "steel", color: spec.palette.metal, bone: BONE[`${sideName}Foot`] });
  const star = new Shape();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? 0.022 : 0.008;
    const a = (i / 16) * Math.PI * 2;
    if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  star.closePath();
  parts.add(extrude(star, 0.003), { material: "steel", color: spec.palette.metal, bone: BONE[`${sideName}Foot`], matrix: mat([x, 0.072, -0.1], [0, Math.PI / 2, 0]) });
  parts.add(sweep({ path: [v3(x, 0.075, -0.075), v3(x, 0.073, -0.098)], rings: [{ w: 0.003, f: 0.003, b: 0.003 }, { w: 0.003, f: 0.003, b: 0.003 }], front: UP, radial: 6 }).geometry, {
    material: "steel",
    color: spec.palette.metal,
    bone: BONE[`${sideName}Foot`],
  });
}

const TORSO_Y = [0.97, 1.1, 1.22, 1.33, 1.42, 1.48, 1.53] as const;
export function torsoRings(k: number, grow: number, gaps?: readonly number[], female = false): Ring[] {
  // [w, f, b, p] per height in TORSO_Y. The female table has wider hips, a narrow waist, a bust and narrower shoulders.
  const base: [number, number, number, number][] = female
    ? [
        [0.165, 0.1, 0.112, 2],
        [0.128, 0.085, 0.084, 2],
        [0.142, 0.1, 0.088, 2.1],
        [0.158, 0.135, 0.094, 2.2],
        [0.165, 0.104, 0.094, 2.4],
        [0.125, 0.08, 0.08, 2.1],
        [0.055, 0.05, 0.05, 2],
      ]
    : [
        [0.158, 0.1, 0.102, 2],
        [0.15, 0.1, 0.096, 2],
        [0.165, 0.115, 0.1, 2.1],
        [0.18, 0.124, 0.104, 2.3],
        [0.186, 0.11, 0.1, 2.5],
        [0.14, 0.088, 0.088, 2.1],
        [0.062, 0.056, 0.056, 2],
      ];
  return base.map(([w, f, b, p], i) => ({ w: w * k + grow, f: f * k + grow, b: b * k + grow, p, gap: gaps?.[i] ?? 0 }));
}

export function buildTorso(parts: PartList, spec: CharacterSpec): void {
  const k = spec.bulk;
  const path = TORSO_Y.map((y) => v3(0, y, -0.01));
  const female = spec.body === "female";
  // A dress has a fitted bodice in the dress colour instead of a shirt.
  const top = spec.coat === "dress" ? spec.palette.coat : spec.palette.shirt;
  const shirt = sweep({ path, rings: torsoRings(k, 0, undefined, female), front: FWD, radial: 24, samples: 16 });
  const at = vertexPositions(shirt.geometry);
  parts.add(shirt.geometry, { material: "cloth", color: top, skin: (v) => torsoSkin(at(v).y) });

  // Shirt collar: a short band with two pointed tips.
  const collar = sweep({
    path: [v3(0, 1.505, -0.016), v3(0, 1.545, -0.02)],
    rings: [
      { w: 0.07, f: 0.066, b: 0.064, gap: 0.12 },
      { w: 0.064, f: 0.06, b: 0.06, gap: 0.2 },
    ],
    front: FWD,
    radial: 18,
  });
  parts.add(collar.geometry, { material: "cloth", color: top, bone: BONE.Neck });
  if (spec.vest) {
    const vestPath = TORSO_Y.slice(0, 5).map((y, i) => v3(0, i === 0 ? 0.955 : y, -0.01));
    const vest = sweep({
      path: vestPath,
      rings: torsoRings(k, 0.009, [0.05, 0.045, 0.07, 0.2, 0.42], female).slice(0, 5),
      front: FWD,
      radial: 24,
      samples: 13,
      // Pointed front tips at the hem.
      deform: (p, u, a) => {
        if (u < 0.12) p.y -= 0.035 * (1 - u / 0.12) * Math.exp(-(((a - Math.PI / 2) / 0.35) ** 2) * 1.0) * (Math.abs(a - Math.PI / 2) > 0.04 ? 1 : 0);
      },
    });
    const vat = vertexPositions(vest.geometry);
    parts.add(vest.geometry, { material: "cloth", color: spec.palette.vest, skin: (v) => torsoSkin(vat(v).y) });
    // Buttons and pocket welts, set on the vest surface (front depth by height, as in torsoRings).
    const vestFront = (y: number) => (y < 1.1 ? 0.1 : y < 1.22 ? 0.1 + ((y - 1.1) / 0.12) * 0.015 : 0.115 + ((y - 1.22) / 0.11) * 0.009) * k + 0.009;
    const button = lathe([[0, 0], [0.0055, 0.0005], [0.006, 0.0025], [0.004, 0.0035], [0, 0.0035]], 10);
    for (let i = 0; i < 4; i++) {
      const y = 1.0 + i * 0.065;
      parts.add(button, { material: "brass", color: spec.palette.metal, bone: i < 2 ? BONE.Spine : BONE.Spine1, matrix: mat([0.011, y, vestFront(y) - 0.0015], [Math.PI / 2, 0, 0]) });
    }
    for (const side of [1, -1] as Side[]) {
      const welt = extrude(polygon([[-0.028, -0.004], [0.028, -0.004], [0.028, 0.004], [-0.028, 0.004]]), 0.004, { size: 0.0012 });
      parts.add(welt, { material: "cloth", color: new Color(spec.palette.vest).multiplyScalar(0.7), bone: BONE.Spine, matrix: mat([0.07 * side * k, 1.08, vestFront(1.08) - 0.012], [0, side * 0.55, side * 0.12]) });
    }
  }

  // Neckerchief: a band around the base of the neck and a triangle lying on the chest, knotted at the throat.
  const kerchief = sweep({
    path: [v3(0, 1.488, -0.016), v3(0, 1.512, -0.018)],
    rings: [
      { w: 0.082, f: 0.074, b: 0.076 },
      { w: 0.074, f: 0.068, b: 0.07 },
    ],
    front: FWD,
    radial: 18,
  });
  parts.add(kerchief.geometry, { material: "cloth", color: spec.palette.neckerchief, bone: BONE.Neck });
  const flap = new Shape();
  flap.moveTo(-0.045, 0);
  flap.quadraticCurveTo(0, 0.006, 0.045, 0);
  flap.quadraticCurveTo(0.018, -0.035, 0, -0.075);
  flap.quadraticCurveTo(-0.018, -0.035, -0.045, 0);
  // Lies on the upper chest, which slopes forward going down.
  parts.add(extrude(flap, 0.005, { size: 0.0015 }), { material: "cloth", color: spec.palette.neckerchief, bone: BONE.Spine2, matrix: mat([0, 1.494, 0.092 * k + 0.004], [-0.36, 0, 0]) });
  parts.add(lathe([[0, -0.011], [0.011, -0.007], [0.013, 0], [0.011, 0.007], [0, 0.011]], 10), {
    material: "cloth",
    color: new Color(spec.palette.neckerchief).multiplyScalar(0.85),
    bone: BONE.Neck,
    matrix: mat([0, 1.497, 0.083], [Math.PI / 2, 0, 0], [1.2, 1, 0.8]),
  });

  if (spec.coat === "poncho") buildPoncho(parts, spec);
  else if (spec.coat === "dress") buildDress(parts, spec);
  else if (spec.coat !== "none") buildCoat(parts, spec);
}

function buildCoat(parts: PartList, spec: CharacterSpec): void {
  const k = spec.bulk * (spec.body === "female" ? 0.93 : 1);
  const hem = { frock: 0.52, duster: 0.32, suit: 0.82, fringe: 0.8 }[spec.coat as "frock" | "duster" | "suit" | "fringe"] ?? 0.52;
  const ys = [hem, (hem + 0.97) / 2, 0.97, 1.1, 1.22, 1.33, 1.42, 1.475, 1.51];
  const rings: Ring[] = [
    { w: 0.225 * k, f: 0.17 * k, b: 0.18 * k, gap: 0.62 },
    { w: 0.198 * k, f: 0.145 * k, b: 0.155 * k, gap: 0.5 },
    { w: 0.17 * k, f: 0.118 * k, b: 0.118 * k, gap: 0.42 },
    { w: 0.164 * k, f: 0.116 * k, b: 0.112 * k, gap: 0.46 },
    { w: 0.178 * k, f: 0.13 * k, b: 0.114 * k, gap: 0.56 },
    { w: 0.194 * k, f: 0.138 * k, b: 0.118 * k, gap: 0.66, p: 2.3 },
    { w: 0.2 * k, f: 0.124 * k, b: 0.114 * k, gap: 0.7, p: 2.5 },
    { w: 0.165 * k, f: 0.102 * k, b: 0.106 * k, gap: 0.72, p: 2.1 },
    { w: 0.104, f: 0.09, b: 0.096, gap: 0.95 },
  ];
  const coat = sweep({
    path: ys.map((y) => v3(0, y, -0.01)),
    rings,
    front: FWD,
    radial: 32,
    samples: 22,
    // A back vent and a gentle swing of the hem keep the skirt from looking like a lampshade.
    deform: (p, u, a) => {
      if (u < 0.3) {
        const back = Math.max(0, -Math.sin(a));
        p.y += 0.02 * back * (1 - u / 0.3) * Math.cos(a * 3) ** 2;
      }
    },
  });
  const at = vertexPositions(coat.geometry);
  parts.add(coat.geometry, { material: "cloth", color: spec.palette.coat, skin: (v) => skirtSkin(at(v)) });

  // Lapels: strips that follow each edge of the opening, standing slightly proud and widening toward the chest.
  if (spec.coat === "fringe") buildFringe(parts, spec, rings[0] as Ring, hem);
  const lapelYs = [1.05, 1.18, 1.3, 1.4, 1.44, 1.46];
  const lapelRings = lapelYs.map((y, i) => {
    const r = rings[Math.min(rings.length - 1, ys.findIndex((yy) => yy >= y))] as Ring;
    const grow = 0.007;
    return { w: r.w + grow, f: r.f + grow, b: r.b + grow, p: r.p, gap: (r.gap ?? 0) - 0.02, span: [0.08, 0.16, 0.3, 0.38, 0.24, 0.08][i] as number };
  });
  for (const side of [1, -1] as Side[]) {
    const lapel = sweep({ path: lapelYs.map((y) => v3(0, y, -0.01)), rings: lapelRings, front: FWD, radial: 6, samples: 14, spanSide: side });
    const lat = vertexPositions(lapel.geometry);
    parts.add(lapel.geometry, { material: "cloth", color: new Color(spec.palette.coat).multiplyScalar(0.86), skin: (v) => torsoSkin(lat(v).y) });
  }
  // Pocket flaps on the hips, lying on the skirt (long coats only).
  for (const side of (hem < 0.7 ? [1, -1] : []) as Side[]) {
    const flap = extrude(polygon([[-0.045, 0], [0.045, 0], [0.042, -0.035], [-0.042, -0.035]]), 0.005, { size: 0.0015 });
    parts.add(flap, { material: "cloth", color: new Color(spec.palette.coat).multiplyScalar(0.9), bone: BONE.Hips, matrix: mat([0.14 * side * k, 0.9, 0.088 * k], [0, side * 0.7, 0]) });
  }
}

export function buildArms(parts: PartList, spec: CharacterSpec): void {
  const k = spec.bulk;
  const sleeveColor = spec.coat === "none" || spec.coat === "poncho" ? spec.palette.shirt : spec.palette.coat;
  for (const side of [1, -1] as Side[]) {
    const s = side;
    const sideName = side === 1 ? "Left" : "Right";
    const sleeve = sweep({
      path: [v3(0.16 * s, 1.445, -0.03), v3(0.2 * s, 1.36, -0.03), v3(0.245 * s, 1.155, -0.025), v3(0.265 * s, 1.04, -0.012), v3(0.281 * s, 0.94, -0.002)],
      rings: [
        { w: 0.066 * k, f: 0.064 * k, b: 0.064 * k },
        { w: 0.06 * k, f: 0.058 * k, b: 0.06 * k },
        { w: 0.05 * k, f: 0.05 * k, b: 0.052 * k },
        { w: 0.048 * k, f: 0.046 * k, b: 0.046 * k },
        { w: 0.05 * k, f: 0.049 * k, b: 0.049 * k },
      ],
      front: FWD,
      radial: 14,
      samples: 14,
      // Fold at the inside of the elbow.
      deform: (p, u, a) => {
        const inner = Math.max(0, Math.sin(a));
        p.addScaledVector(v3(0, 0.004, -0.004), inner * Math.exp(-(((u - 0.5) / 0.06) ** 2)));
      },
    });
    parts.add(sleeve.geometry, {
      material: "cloth",
      color: sleeveColor,
      skin: chainSkin(sleeve.along, [
        { bone: BONE[`${sideName}Shoulder`], from: 0 },
        { bone: BONE[`${sideName}Arm`], from: 0.1 },
        { bone: BONE[`${sideName}ForeArm`], from: 0.5 },
      ]),
    });
    // Turned-back cuff and the shirt cuff peeking out of it.
    const cuff = sweep({
      path: [v3(0.277 * s, 0.965, -0.004), v3(0.283 * s, 0.928, 0.0)],
      rings: [
        { w: 0.053 * k, f: 0.052 * k, b: 0.052 * k },
        { w: 0.055 * k, f: 0.054 * k, b: 0.054 * k },
      ],
      front: FWD,
      radial: 14,
    });
    parts.add(cuff.geometry, { material: "cloth", color: new Color(sleeveColor).multiplyScalar(0.85), bone: BONE[`${sideName}ForeArm`] });
    const shirtCuff = sweep({
      path: [v3(0.282 * s, 0.94, 0.0), v3(0.286 * s, 0.912, 0.002)],
      rings: [
        { w: 0.04, f: 0.038, b: 0.038 },
        { w: 0.039, f: 0.037, b: 0.037 },
      ],
      front: FWD,
      radial: 12,
    });
    parts.add(shirtCuff.geometry, { material: "cloth", color: spec.palette.shirt, bone: BONE[`${sideName}ForeArm`] });
    void L;
  }
}
