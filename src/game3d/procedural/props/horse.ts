import { Group, Mesh, Shape, Vector3, type BufferGeometry, type Object3D } from "three";
import { PartList, triangleCount } from "../core/parts";
import { extrude, lathe, mat } from "../core/shapes";
import { sweep } from "../core/sweep";
import { isMaterialKey, material } from "../materials";

/**
 * A stylised horse (about 2.3 m long, 1.5 m at the withers), facing +Z. Body, neck and head are lofted; each leg is
 * its own pivot group (origin at the shoulder or hip) so a gait can swing them; the head and neck hang from a neck
 * pivot for nodding. Optional saddle (the Mustang, riders) or harness collar (the stagecoach team).
 */

const v3 = (x: number, y: number, z: number) => new Vector3(x, y, z);
const UP = v3(0, 1, 0);

export interface HorseOptions {
  coat?: string;
  mane?: string;
  saddle?: boolean;
  harness?: boolean;
}

const cache = new Map<string, { body: Map<string, BufferGeometry>; neck: Map<string, BufferGeometry>; legs: Map<string, BufferGeometry>[] }>();

function geometry(o: Required<HorseOptions>) {
  const key = JSON.stringify(o);
  const hit = cache.get(key);
  if (hit) return hit;
  const coat = o.coat;
  const dark = o.mane;

  // Body: a barrel lofted from rump to chest; rings face up (f = topline, b = belly).
  const body = new PartList({ skinned: false });
  const torso = sweep({
    path: [v3(0, 1.3, -0.8), v3(0, 1.33, -0.58), v3(0, 1.26, -0.15), v3(0, 1.28, 0.25), v3(0, 1.3, 0.56), v3(0, 1.3, 0.74)],
    rings: [
      { w: 0.14, f: 0.1, b: 0.16 },
      { w: 0.25, f: 0.2, b: 0.29 },
      { w: 0.27, f: 0.19, b: 0.33 },
      { w: 0.26, f: 0.22, b: 0.32 },
      { w: 0.22, f: 0.22, b: 0.3 },
      { w: 0.13, f: 0.14, b: 0.18 },
    ],
    front: UP,
    radial: 18,
    samples: 16,
    capStart: true,
    capEnd: true,
  });
  body.add(torso.geometry, { material: "skin", color: coat });
  // Tail: thick at the dock, flowing down and back.
  const tail = sweep({
    path: [v3(0, 1.38, -0.8), v3(0, 1.3, -0.95), v3(0, 1.0, -1.05), v3(0, 0.7, -1.0)],
    rings: [
      { w: 0.045, f: 0.05, b: 0.05 },
      { w: 0.07, f: 0.06, b: 0.06 },
      { w: 0.1, f: 0.07, b: 0.07 },
      { w: 0.05, f: 0.03, b: 0.03 },
    ],
    front: v3(0, 0, -1),
    radial: 10,
    samples: 10,
    capEnd: true,
  });
  body.add(tail.geometry, { material: "hair", color: dark });
  if (o.saddle) {
    // Saddle seat (a cap over the back, open underneath), horn, cantle, blanket and stirrups.
    const seat = sweep({
      path: [v3(0, 1.5, -0.3), v3(0, 1.51, -0.08), v3(0, 1.53, 0.14)],
      rings: [
        { w: 0.25, f: 0.2, b: 0.07, gap: 1.5 },
        { w: 0.28, f: 0.22, b: 0.06, gap: 1.5 },
        { w: 0.26, f: 0.2, b: 0.08, gap: 1.5 },
      ],
      front: v3(0, -1, 0),
      radial: 14,
      samples: 6,
    });
    body.add(seat.geometry, { material: "leather", color: "#5a3420" });
    const blanket = sweep({
      path: [v3(0, 1.49, -0.4), v3(0, 1.5, 0.24)],
      rings: [
        { w: 0.285, f: 0.3, b: 0.045, gap: 1.2 },
        { w: 0.285, f: 0.3, b: 0.045, gap: 1.2 },
      ],
      front: v3(0, -1, 0),
      radial: 14,
    });
    body.add(blanket.geometry, { material: "cloth", color: "#8a2f24" });
    body.add(lathe([[0, 0], [0.03, 0], [0.025, 0.08], [0.05, 0.1], [0.045, 0.12], [0, 0.12]], 10), { material: "leather", color: "#4a2a18", matrix: mat([0, 1.55, 0.16]) });
    body.add(extrude(new Shape().absarc(0, 0, 0.12, 0, Math.PI, false), 0.04, { size: 0.01 }, 8), { material: "leather", color: "#4a2a18", matrix: mat([0, 1.52, -0.3]) });
    for (const sx of [-1, 1]) {
      const strap = sweep({ path: [v3(sx * 0.26, 1.45, 0), v3(sx * 0.29, 1.1, 0.02), v3(sx * 0.3, 0.86, 0.02)], rings: [{ w: 0.025, f: 0.004, b: 0.004 }, { w: 0.025, f: 0.004, b: 0.004 }, { w: 0.025, f: 0.004, b: 0.004 }], front: v3(sx, 0, 0), radial: 4 });
      body.add(strap.geometry, { material: "leather", color: "#3a2214" });
      const stirrup = sweep({
        path: Array.from({ length: 9 }, (_, i) => {
          const a = (i / 8) * Math.PI;
          return v3(sx * 0.3, 0.84 - Math.sin(a) * 0.07, 0.02 + Math.cos(a) * 0.06);
        }),
        rings: Array.from({ length: 9 }, () => ({ w: 0.012, f: 0.02, b: 0.02 })),
        front: v3(sx, 0, 0),
        radial: 6,
      });
      body.add(stirrup.geometry, { material: "steel", color: "#6a6058" });
    }
  }
  if (o.harness) {
    const collar = sweep({
      path: Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return v3(Math.cos(a) * 0.2, 1.5 + Math.sin(a) * 0.26, 0.72);
      }),
      rings: Array.from({ length: 16 }, () => ({ w: 0.05, f: 0.05, b: 0.05 })),
      front: v3(0, 0, 1),
      radial: 8,
      closed: true,
    });
    body.add(collar.geometry, { material: "leather", color: "#3a2214" });
  }

  // Neck and head hang from the neck pivot at the withers (0, 1.45, 0.55): built relative to it.
  const neck = new PartList({ skinned: false });
  const P = (x: number, y: number, z: number) => v3(x, y - 1.45, z - 0.55);
  const neckLoft = sweep({
    path: [P(0, 1.34, 0.38), P(0, 1.58, 0.74), P(0, 1.82, 0.96), P(0, 1.95, 1.06)],
    rings: [
      { w: 0.19, f: 0.32, b: 0.22 },
      { w: 0.14, f: 0.22, b: 0.15 },
      { w: 0.105, f: 0.14, b: 0.11 },
      { w: 0.088, f: 0.105, b: 0.095 },
    ],
    front: v3(0, -0.6, 1).normalize(),
    radial: 14,
    samples: 10,
  });
  neck.add(neckLoft.geometry, { material: "skin", color: coat });
  const head = sweep({
    path: [P(0, 1.98, 1.02), P(0, 1.9, 1.16), P(0, 1.76, 1.3), P(0, 1.64, 1.4), P(0, 1.6, 1.43)],
    rings: [
      { w: 0.085, f: 0.09, b: 0.1 },
      { w: 0.095, f: 0.1, b: 0.1 },
      { w: 0.075, f: 0.08, b: 0.085 },
      { w: 0.065, f: 0.07, b: 0.075 },
      { w: 0.055, f: 0.05, b: 0.06 },
    ],
    front: v3(0, -0.4, 1).normalize(),
    radial: 14,
    samples: 12,
    capEnd: true,
    capStart: true,
  });
  neck.add(head.geometry, { material: "skin", color: coat });
  // Ears, eyes, nostrils, a blaze and the mane.
  const ear = new Shape();
  ear.moveTo(-0.02, 0);
  ear.quadraticCurveTo(-0.025, 0.07, 0, 0.11);
  ear.quadraticCurveTo(0.025, 0.07, 0.02, 0);
  ear.closePath();
  for (const sx of [-1, 1]) {
    neck.add(extrude(ear, 0.015, { size: 0.004 }, 6), { material: "skin", color: coat, matrix: mat([sx * 0.045, 2.04 - 1.45, 1.0 - 0.55], [-0.3, sx * 0.4, sx * -0.15]) });
    neck.add(lathe([[0, -0.016], [0.014, -0.01], [0.016, 0], [0.014, 0.01], [0, 0.016]], 8), { material: "eye", color: "#100c08", matrix: mat([sx * 0.085, 1.94 - 1.45, 1.14 - 0.55], [0, 0, Math.PI / 2]) });
    neck.add(lathe([[0, -0.01], [0.012, -0.006], [0.013, 0], [0.012, 0.006], [0, 0.01]], 8), { material: "eye", color: "#1a120c", matrix: mat([sx * 0.032, 1.63 - 1.45, 1.43 - 0.55], [Math.PI / 2, 0, 0]) });
  }
  const mane = sweep({
    path: [P(0, 1.64, 0.62), P(0, 1.88, 0.86), P(0, 2.04, 1.0)],
    rings: [
      { w: 0.02, f: 0.09, b: 0.0 },
      { w: 0.022, f: 0.08, b: 0.0 },
      { w: 0.018, f: 0.05, b: 0.0 },
    ],
    front: v3(0, 0.7, -0.6).normalize(),
    radial: 6,
    samples: 10,
    deform: (p, u) => {
      p.y += 0.01 * Math.sin(u * 40);
    },
  });
  neck.add(mane.geometry, { material: "hair", color: dark });
  if (o.saddle || o.harness) {
    // Bridle: a noseband around the muzzle, in the plane across the head.
    const c = P(0, 1.72, 1.3);
    const across = v3(0, 0.68, 0.73);
    const band = sweep({
      path: Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return c.clone().add(v3(Math.cos(a) * 0.078, 0, 0)).addScaledVector(across, Math.sin(a) * 0.082);
      }),
      rings: Array.from({ length: 12 }, () => ({ w: 0.006, f: 0.012, b: 0.012 })),
      front: v3(0, -0.73, 0.68),
      radial: 4,
      closed: true,
    });
    neck.add(band.geometry, { material: "leather", color: "#2e1a10" });
  }

  // Legs: built from the joint down; front legs straight with a knee, hind legs with a hock that angles back.
  const legs: Map<string, BufferGeometry>[] = [];
  const legDefs = [
    { top: v3(0.15, 1.15, 0.5), path: [v3(0, 0, 0), v3(0, -0.4, 0.04), v3(0, -0.72, 0.03), v3(0, -1.0, 0.02), v3(0, -1.06, 0.04)] },
    { top: v3(-0.15, 1.15, 0.5), path: [v3(0, 0, 0), v3(0, -0.4, 0.04), v3(0, -0.72, 0.03), v3(0, -1.0, 0.02), v3(0, -1.06, 0.04)] },
    { top: v3(0.15, 1.2, -0.55), path: [v3(0, 0, 0), v3(0, -0.5, -0.17), v3(0, -0.82, -0.07), v3(0, -1.06, -0.05), v3(0, -1.11, -0.03)] },
    { top: v3(-0.15, 1.2, -0.55), path: [v3(0, 0, 0), v3(0, -0.5, -0.17), v3(0, -0.82, -0.07), v3(0, -1.06, -0.05), v3(0, -1.11, -0.03)] },
  ];
  for (const [i, def] of legDefs.entries()) {
    const lp = new PartList({ skinned: false });
    const hind = i >= 2;
    const leg = sweep({
      path: def.path,
      rings: [
        { w: 0.1, f: hind ? 0.17 : 0.13, b: 0.12 },
        { w: 0.06, f: 0.07, b: 0.06 },
        { w: 0.04, f: 0.045, b: 0.04 },
        { w: 0.05, f: 0.05, b: 0.05 },
        { w: 0.045, f: 0.045, b: 0.045 },
      ],
      front: v3(0, 0, 1),
      radial: 10,
      samples: 12,
    });
    const pos = leg.geometry.getAttribute("position");
    lp.add(leg.geometry, {
      material: "skin",
      color: coat,
      // Dark points below the knees and hocks.
      colorAt: (v, base, out) => {
        out.copy(base);
        if (pos.getY(v) < (hind ? -0.75 : -0.6)) out.set(dark);
      },
    });
    const hoofY = def.path[def.path.length - 1]?.y ?? -1;
    lp.add(lathe([[0, 0], [0.058, 0], [0.055, 0.05], [0.045, 0.075], [0, 0.075]], 12), { material: "leather", color: "#2a2420", matrix: mat([0, hoofY - 0.09, (def.path[def.path.length - 1]?.z ?? 0) + 0.01]) });
    legs.push(lp.build());
  }
  const out = { body: body.build(), neck: neck.build(), legs };
  cache.set(key, out);
  return out;
}

export interface BuiltHorse {
  group: Group;
  legs: Object3D[];
  neck: Object3D;
  triangles: number;
}

export function buildHorse(options: HorseOptions = {}): BuiltHorse {
  const o: Required<HorseOptions> = { coat: "#6e4226", mane: "#1e1612", saddle: false, harness: false, ...options };
  const g = geometry(o);
  const group = new Group();
  group.name = "prop.horse";
  let triangles = 0;
  const add = (parent: Object3D, parts: Map<string, BufferGeometry>) => {
    for (const [key, geo] of parts) {
      if (!isMaterialKey(key)) continue;
      const m = new Mesh(geo, material(key));
      m.castShadow = true;
      parent.add(m);
      triangles += triangleCount(geo);
    }
  };
  add(group, g.body);
  const neck = new Group();
  neck.position.set(0, 1.45, 0.55);
  add(neck, g.neck);
  group.add(neck);
  const tops = [v3(0.15, 1.15, 0.5), v3(-0.15, 1.15, 0.5), v3(0.15, 1.2, -0.55), v3(-0.15, 1.2, -0.55)];
  const legs = g.legs.map((parts, i) => {
    const pivot = new Group();
    pivot.position.copy(tops[i] as Vector3);
    add(pivot, parts);
    group.add(pivot);
    return pivot;
  });
  return { group, legs, neck, triangles };
}

/**
 * Poses a horse for time t (seconds). "idle" breathes and nods; "walk" and "gallop" swing the legs in their gait
 * order. No allocation per call.
 */
export function animateHorse(h: BuiltHorse, t: number, gait: "idle" | "walk" | "gallop"): void {
  const [fl, fr, hl, hr] = h.legs as [Object3D, Object3D, Object3D, Object3D];
  if (gait === "idle") {
    for (const l of h.legs) l.rotation.x = 0;
    h.neck.rotation.x = 0.06 * Math.sin(t * 0.7) + 0.03;
    h.group.children[0]?.position.set(0, 0.006 * Math.sin(t * 1.6), 0);
    return;
  }
  const speed = gait === "gallop" ? 9 : 4.2;
  const amp = gait === "gallop" ? 0.62 : 0.32;
  const p = t * speed;
  // Gallop: hind pair then front pair, slightly staggered; walk: four-beat diagonal sequence.
  const phase = gait === "gallop" ? [0, 0.35, Math.PI, Math.PI + 0.35] : [0, Math.PI, Math.PI / 2, (3 * Math.PI) / 2];
  fl.rotation.x = amp * Math.sin(p + (phase[0] as number));
  fr.rotation.x = amp * Math.sin(p + (phase[1] as number));
  hl.rotation.x = amp * Math.sin(p + (phase[2] as number));
  hr.rotation.x = amp * Math.sin(p + (phase[3] as number));
  h.neck.rotation.x = (gait === "gallop" ? 0.12 : 0.05) * Math.sin(p * 2);
}
