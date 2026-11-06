import { Color, Shape, Vector3 } from "three";
import type { PartList } from "../core/parts";
import { extrude, lathe, mat } from "../core/shapes";
import { sweep, type Ring } from "../core/sweep";
import { BONE } from "./skeleton";
import { chainSkin, smooth } from "./skin";
import type { CharacterSpec } from "./spec";

// The head: a vertical loft sculpted with a few soft deformations (jaw, cheekbones, eye sockets, brow, lips), plus
// separate nose, ears, eyes with lids, brows, moustache and hair. All rigid on the Head bone except the neck.

const v3 = (x: number, y: number, z: number) => new Vector3(x, y, z);
const FWD = v3(0, 0, 1);
const bump = (dx: number, dy: number, sx: number, sy: number) => Math.exp(-((dx / sx) ** 2) - (dy / sy) ** 2);

export function buildHead(parts: PartList, spec: CharacterSpec): void {
  const f = spec.face;
  const skin = spec.palette.skin;
  const jaw = f.jaw;

  // Neck: from inside the collar up into the skull.
  const neck = sweep({
    path: [v3(0, 1.47, -0.02), v3(0, 1.54, -0.012), v3(0, 1.6, -0.01)],
    rings: [
      { w: 0.058, f: 0.056, b: 0.062 },
      { w: 0.052, f: 0.05, b: 0.058 },
      { w: 0.05, f: 0.048, b: 0.056 },
    ],
    front: FWD,
    radial: 14,
    samples: 5,
  });
  parts.add(neck.geometry, {
    material: "skin",
    color: skin,
    skin: chainSkin(neck.along, [
      { bone: BONE.Neck, from: 0 },
      { bone: BONE.Head, from: 0.7 },
    ]),
  });

  // Skull and face. Rings from under the chin to the crown; oz pushes the chin and jaw forward of the skull centre.
  const levels: [number, Ring][] = [
    [1.552, { w: 0.022 * jaw, f: 0.016, b: 0.016, oz: 0.064 }],
    [1.566, { w: 0.05 * jaw, f: 0.04, b: 0.03, oz: 0.042, p: 2.2 }],
    [1.585, { w: 0.064 * jaw, f: 0.068, b: 0.05, oz: 0.022, p: 2.5 }],
    [1.61, { w: 0.069 * jaw, f: 0.083, b: 0.072, oz: 0.01, p: 2.3 }],
    [1.64, { w: 0.073, f: 0.088, b: 0.088, oz: 0.002, p: 2.1 }],
    [1.672, { w: 0.075, f: 0.087, b: 0.097, oz: -0.004, p: 2.1 }],
    [1.705, { w: 0.076, f: 0.088, b: 0.1, oz: -0.006, p: 2.05 }],
    [1.738, { w: 0.073, f: 0.079, b: 0.1, oz: -0.01 }],
    [1.768, { w: 0.063, f: 0.062, b: 0.09, oz: -0.012 }],
    [1.792, { w: 0.043, f: 0.038, b: 0.06, oz: -0.014 }],
    [1.806, { w: 0.01, f: 0.009, b: 0.012, oz: -0.014 }],
  ];
  const eyeY = 1.684;
  const eyeX = 0.031;
  const browY = 1.71 + f.brow;
  const head = sweep({
    path: levels.map(([y]) => v3(0, y, 0)),
    rings: levels.map(([, r]) => r),
    front: FWD,
    radial: 30,
    samples: 30,
    capEnd: true,
    deform: (p) => {
      const front = smooth(0.02, 0.08, p.z);
      const ax = Math.abs(p.x);
      // Eye sockets in, brow ridge and cheekbones out, a soft groove at the temples.
      p.z -= 0.011 * front * bump(ax - eyeX, p.y - eyeY, 0.02, 0.012);
      p.z += 0.007 * front * bump(ax - 0.03, p.y - (browY + 0.006), 0.03, 0.007);
      const cheek = bump(ax - 0.054, p.y - 1.652, 0.02, 0.02) * front;
      p.x += Math.sign(p.x) * 0.006 * cheek;
      p.z += 0.004 * cheek;
      // Mouth: a slight upper-lip bulge and a dent under the lower lip.
      p.z += 0.004 * front * bump(p.x, p.y - 1.603, 0.022, 0.006);
      p.z -= 0.004 * front * bump(p.x, p.y - 1.584, 0.02, 0.005);
      // Chin point.
      p.z += 0.005 * front * bump(p.x, p.y - 1.566, 0.018, 0.01);
      p.x -= Math.sign(p.x) * 0.004 * bump(ax - 0.074, p.y - 1.715, 0.01, 0.02);
    },
  });
  const pos = head.geometry.getAttribute("position");
  const lip = new Color(skin).lerp(new Color("#8a4a3c"), 0.45);
  const stubble = new Color(skin).lerp(new Color(spec.palette.hair), 0.55);
  parts.add(head.geometry, {
    material: "skin",
    color: skin,
    bone: BONE.Head,
    colorAt: (v, base, out) => {
      const x = pos.getX(v);
      const y = pos.getY(v);
      const z = pos.getZ(v);
      const front = smooth(0.03, 0.07, z);
      // Lips, then stubble along the jaw and chin, then a little colour on the cheeks.
      const lips = front * bump(x, y - 1.596, 0.02, 0.006);
      out.copy(base).lerp(lip, Math.min(1, lips * 1.2));
      const beardZone = smooth(1.625, 1.6, y) * smooth(1.548, 1.56, y) * (1 - lips);
      out.lerp(stubble, f.stubble * beardZone * 0.75);
      out.lerp(new Color("#c06a55"), 0.12 * front * bump(Math.abs(x) - 0.05, y - 1.645, 0.02, 0.015));
      // Sideburns: in front of the ears, from the hairline down to the cheekbone.
      const burns = smooth(0.058, 0.068, Math.abs(x)) * smooth(1.625, 1.64, y) * smooth(1.73, 1.71, y) * smooth(0.045, 0.02, z) * smooth(-0.025, -0.005, z);
      out.lerp(new Color(spec.palette.hair), Math.min(1, burns * 1.3));
    },
  });

  // Nose: bridge → tip → base, broad at the root so it grows out of the face rather than sitting on it.
  const n = f.nose;
  const nose = sweep({
    path: [v3(0, 1.692, 0.074), v3(0, 1.672, 0.084), v3(0, 1.652, 0.094 + 0.005 * (n - 1)), v3(0, 1.638, 0.098 + 0.006 * (n - 1)), v3(0, 1.627, 0.09)],
    rings: [
      { w: 0.012 * n, f: 0.004, b: 0.012 },
      { w: 0.0105 * n, f: 0.006, b: 0.014 },
      { w: 0.012 * n, f: 0.0085, b: 0.016 },
      { w: 0.015 * n, f: 0.01, b: 0.015 },
      { w: 0.0165 * n, f: 0.005, b: 0.012 },
    ],
    front: FWD,
    radial: 12,
    samples: 10,
    capStart: true,
    capEnd: true,
  });
  parts.add(nose.geometry, { material: "skin", color: skin, bone: BONE.Head });
  // Nostril wings: flattened lobes tucked against the cheek.
  for (const s of [1, -1]) {
    const wing = lathe([[0, -0.006], [0.0065, -0.004], [0.0075, 0], [0.0055, 0.004], [0, 0.006]], 8);
    parts.add(wing, { material: "skin", color: skin, bone: BONE.Head, matrix: mat([0.0105 * s * n, 1.629, 0.09], [Math.PI / 2, 0, s * 0.4], [0.9, 0.8, 0.75]) });
  }

  // Ears: an outer rim with a bowl inside, angled back.
  const ear = new Shape();
  ear.moveTo(0, -0.026);
  ear.bezierCurveTo(0.02, -0.03, 0.022, 0.0, 0.018, 0.016);
  ear.bezierCurveTo(0.014, 0.032, -0.006, 0.034, -0.01, 0.02);
  ear.bezierCurveTo(-0.012, 0.005, -0.008, -0.014, 0, -0.026);
  const bowl = new Shape();
  bowl.moveTo(0.002, -0.014);
  bowl.bezierCurveTo(0.013, -0.014, 0.014, 0.008, 0.01, 0.016);
  bowl.bezierCurveTo(0.004, 0.024, -0.004, 0.016, -0.003, 0.004);
  bowl.closePath();
  ear.holes.push(bowl);
  const earRim = extrude(ear, 0.01, { size: 0.0025, thickness: 0.003, segments: 2 }, 10);
  const earInner = extrude(bowl, 0.004, undefined, 10);
  for (const s of [1, -1]) {
    const m = mat([0.074 * s, 1.672, -0.012], [0, s * (Math.PI / 2 - 0.3), 0.12 * s]);
    parts.add(earRim, { material: "skin", color: skin, bone: BONE.Head, matrix: m });
    parts.add(earInner, { material: "skin", color: new Color(skin).multiplyScalar(0.82), bone: BONE.Head, matrix: m.clone().multiply(mat([0, 0, -0.002])) });
  }

  // Eyes: eyeballs set into the sockets, iris and pupil painted by angle, then upper and lower lids: caps around
  // the up and down axes that leave an almond-shaped opening at the front (narrower with squint).
  const R = 0.0122;
  const eyeZ = 0.059;
  const ball = lathe(
    Array.from({ length: 11 }, (_, i) => {
      const a = -Math.PI / 2 + (i / 10) * Math.PI;
      return [Math.cos(a) * R, Math.sin(a) * R] as const;
    }),
    14,
  );
  const ballPos = ball.getAttribute("position");
  const iris = new Color(spec.palette.eyes);
  const lidColor = new Color(skin).multiplyScalar(0.93);
  const lash = new Color(spec.palette.hair).lerp(new Color(skin), 0.3);
  for (const s of [1, -1]) {
    parts.add(ball, {
      material: "eye",
      color: "#e6dfd2",
      bone: BONE.Head,
      // The lathe's +Y pole becomes the front after rotating; colour by how close a vertex is to that pole.
      colorAt: (v, base, out) => {
        const yy = ballPos.getY(v) / R;
        if (yy > 0.9) out.set("#0d0a08");
        else if (yy > 0.66) out.copy(iris).multiplyScalar(0.8 + 0.3 * (yy - 0.66) / 0.24);
        else out.copy(base);
      },
      matrix: mat([eyeX * s, eyeY, eyeZ], [Math.PI / 2 - 0.05, s * 0.12, 0]),
    });
    const upper = Math.PI / 2 - 0.12 - 0.35 * f.squint; // angle from straight up that the upper lid covers
    const lower = Math.PI / 2 - 0.42 - 0.12 * f.squint;
    for (const [cover, flip] of [
      [upper, false],
      [lower, true],
    ] as const) {
      const lid = lathe(
        Array.from({ length: 8 }, (_, i) => {
          const a = Math.PI / 2 - (i / 7) * cover;
          return [Math.cos(a) * (R + 0.0012), Math.sin(a) * (R + 0.0012)] as const;
        }).concat([[Math.cos(Math.PI / 2 - cover) * (R + 0.0028), Math.sin(Math.PI / 2 - cover) * (R + 0.0028)]]),
        16,
      );
      const lidPos = lid.getAttribute("position");
      parts.add(lid, {
        material: "skin",
        color: lidColor,
        bone: BONE.Head,
        // Darken the rim of the upper lid into a lash line.
        colorAt: (v, base, out) => {
          const h = Math.abs(lidPos.getY(v)) / (R + 0.0028);
          out.copy(base);
          if (!flip && h < Math.cos(cover) + 0.12) out.lerp(lash, 0.75);
        },
        matrix: mat([eyeX * s, eyeY + (flip ? -0.0005 : 0.0008), eyeZ], flip ? [Math.PI - 0.15, s * 0.12, 0] : [0.18, s * 0.12, 0]),
      });
    }
  }

  // Brows: thick tapered arcs; lower and closer for a frown.
  const brow = new Shape();
  brow.moveTo(-0.02, -0.002);
  brow.quadraticCurveTo(0, 0.008, 0.022, 0.0);
  brow.quadraticCurveTo(0.024, 0.004, 0.02, 0.006);
  brow.quadraticCurveTo(0, 0.014, -0.02, 0.005);
  brow.closePath();
  const browGeo = extrude(brow, 0.0045, { size: 0.0012 });
  for (const s of [1, -1]) {
    parts.add(browGeo, { material: "hair", color: spec.palette.hair, bone: BONE.Head, matrix: mat([0.031 * s, browY, 0.084], [-0.2, s * 0.3, s * -0.08], [s, 1, 1]) });
  }

  buildFacialHair(parts, spec);

  // Hair: the back and sides below the hat, with sideburns.
  const hair = sweep({
    path: [v3(0, 1.6, -0.012), v3(0, 1.66, -0.012), v3(0, 1.72, -0.012), v3(0, 1.765, -0.014)],
    rings: [
      { w: 0.064, f: 0.06, b: 0.084, gap: 1.75 },
      { w: 0.079, f: 0.08, b: 0.1, gap: 1.62 },
      { w: 0.08, f: 0.085, b: 0.106, gap: 1.4 },
      { w: 0.068, f: 0.07, b: 0.096, gap: 1.2 },
    ],
    front: FWD,
    radial: 20,
    samples: 8,
    deform: (p, u, a) => {
      // Ragged lower edge at the nape.
      if (u < 0.15) p.y -= 0.008 * Math.abs(Math.sin(a * 9)) * (1 - u / 0.15);
    },
  });
  parts.add(hair.geometry, { material: "hair", color: spec.palette.hair, bone: BONE.Head });
}

function buildFacialHair(parts: PartList, spec: CharacterSpec): void {
  const style = spec.face.mustache;
  if (style === "none") return;
  const wide = style === "handlebar" ? 0.05 : style === "walrus" ? 0.034 : 0.03;
  const drop = style === "walrus" ? 0.014 : style === "handlebar" ? -0.008 : 0.004;
  const thick = style === "walrus" ? 1.5 : 1;
  const path = [
    v3(-wide, 1.603 - drop, 0.083),
    v3(-0.02, 1.607, 0.1),
    v3(0, 1.612, 0.107),
    v3(0.02, 1.607, 0.1),
    v3(wide, 1.603 - drop, 0.083),
  ];
  if (style === "handlebar") {
    path.unshift(v3(-wide - 0.006, 1.618, 0.074));
    path.push(v3(wide + 0.006, 1.618, 0.074));
  }
  const tip = { w: 0.002, f: 0.002, b: 0.002 };
  const mid = { w: 0.008 * thick, f: 0.0045 * thick, b: 0.004 * thick };
  const rings: Ring[] = path.map((_, i) => {
    const t = Math.abs(i / (path.length - 1) - 0.5) * 2;
    return t > 0.95 ? tip : { w: mid.w * (1 - 0.6 * t), f: mid.f * (1 - 0.5 * t), b: mid.b * (1 - 0.5 * t) };
  });
  const m = sweep({ path, rings, front: new Vector3(0, -0.4, 1).normalize(), radial: 8, samples: 18, capStart: true, capEnd: true });
  parts.add(m.geometry, { material: "hair", color: spec.palette.hair, bone: BONE.Head });
}
