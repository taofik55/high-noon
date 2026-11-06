import { Group, IcosahedronGeometry, Mesh, Path, Shape, Vector3 } from "three";
import { PartList, triangleCount } from "../core/parts";
import { extrude, lathe, mat, polygon, roundedRect } from "../core/shapes";
import { sweep } from "../core/sweep";
import { isMaterialKey, material } from "../materials";
import { buildHorse } from "./horse";

/** Props for seats and scenes (docs/05 §5–6): every one built from shaped geometry, a few draw calls each. */

const v3 = (x: number, y: number, z: number) => new Vector3(x, y, z);

export interface BuiltProp {
  group: Group;
  triangles: number;
}

function toGroup(parts: PartList, name: string): BuiltProp {
  const group = new Group();
  group.name = name;
  let triangles = 0;
  for (const [key, g] of parts.build()) {
    if (!isMaterialKey(key)) continue;
    const m = new Mesh(g, material(key));
    m.castShadow = key !== "glass";
    m.receiveShadow = true;
    m.name = `${name}.${key}`;
    group.add(m);
    triangles += triangleCount(g);
  }
  return { group, triangles };
}

/** Seeded random numbers so props look the same every time. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/** A spoked wagon wheel (axis along X): iron tyre, felloe, hub and spokes. */
function addWheel(parts: PartList, r: number, at: [number, number, number], spokes = 12): void {
  const m = mat(at, [0, 0, Math.PI / 2]);
  parts.add(lathe([[r - 0.035, -0.035], [r, -0.035], [r + 0.008, -0.025], [r + 0.008, 0.025], [r, 0.035], [r - 0.035, 0.035]], 28), { material: "wood", color: "#5a3a22", matrix: m });
  parts.add(lathe([[r, -0.03], [r + 0.012, -0.03], [r + 0.012, 0.03], [r, 0.03]], 28), { material: "steel", color: "#2e2a26", matrix: m });
  parts.add(lathe([[0, -0.09], [0.05, -0.09], [0.07, -0.05], [0.08, 0], [0.07, 0.05], [0.05, 0.09], [0, 0.09]], 12), { material: "wood", color: "#4a2e1c", matrix: m });
  const spoke = extrude(polygon([[-0.014, 0.07], [0.014, 0.07], [0.01, r - 0.03], [-0.01, r - 0.03]]), 0.03, { size: 0.004 });
  for (let i = 0; i < spokes; i++) parts.add(spoke, { material: "wood", color: "#6a4428", matrix: m.clone().multiply(mat([0, 0, 0], [0, (i / spokes) * Math.PI * 2, 0])).multiply(mat([0, 0, 0], [Math.PI / 2, 0, 0])) });
}

/** Ammunition wagon with a Gatling gun on a swivel (Gatling scenes). Faces +Z (the gun points forward). */
export function buildGatlingWagon(): BuiltProp {
  const p = new PartList({ skinned: false });
  // Bed: plank sides and floor on two axles, with a tongue for the team.
  p.add(extrude(roundedRect(1.3, 2.4, 0.02), 0.06), { material: "wood", color: "#6b4a2b", matrix: mat([0, 0.8, 0], [Math.PI / 2, 0, 0]) });
  for (const sx of [-1, 1]) p.add(extrude(roundedRect(2.4, 0.4, 0.02, 0, 0.2), 0.05, { size: 0.01 }), { material: "wood", color: "#7a5432", matrix: mat([sx * 0.66, 0.8, 0], [0, Math.PI / 2, 0]) });
  for (const sz of [-1, 1]) p.add(extrude(roundedRect(1.3, 0.4, 0.02, 0, 0.2), 0.05, { size: 0.01 }), { material: "wood", color: "#7a5432", matrix: mat([0, 0.8, sz * 1.2]) });
  for (const z of [-0.8, 0.8]) {
    p.add(lathe([[0.035, -0.8], [0.035, 0.8], [0, 0.8]], 8), { material: "steel", color: "#2e2a26", matrix: mat([0, 0.5, z], [0, 0, Math.PI / 2]) });
    for (const sx of [-1, 1]) addWheel(p, 0.48, [sx * 0.82, 0.5, z]);
  }
  p.add(extrude(roundedRect(0.08, 0.08, 0.01), 1.6), { material: "wood", color: "#5a3a22", matrix: mat([0, 0.55, 2.0]) });
  // Gatling: six barrels around a rotating axis, front and rear plates, breech case, hopper and crank.
  const gun = mat([0, 1.35, 0.3]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    p.add(lathe([[0.012, 0], [0.016, 0], [0.016, 0.9], [0.012, 0.9]], 8), { material: "steel", color: "#3a3e46", matrix: gun.clone().multiply(mat([Math.cos(a) * 0.055, Math.sin(a) * 0.055, 0], [Math.PI / 2, 0, 0])) });
  }
  for (const z of [0.25, 0.85]) p.add(lathe([[0, 0], [0.085, 0], [0.085, 0.025], [0, 0.025]], 18), { material: "brass", color: "#b8923e", matrix: gun.clone().multiply(mat([0, 0, z], [Math.PI / 2, 0, 0])) });
  p.add(extrude(roundedRect(0.22, 0.24, 0.03), 0.34, { size: 0.015 }), { material: "brass", color: "#b8923e", matrix: gun.clone().multiply(mat([0, 0, -0.1])) });
  p.add(extrude(polygon([[-0.06, 0], [0.06, 0], [0.04, 0.16], [-0.04, 0.16]]), 0.09, { size: 0.006 }), { material: "steel", color: "#2e2a26", matrix: gun.clone().multiply(mat([0, 0.12, -0.05])) });
  const crank = sweep({ path: [v3(0.12, 0, -0.15), v3(0.2, 0, -0.15), v3(0.2, -0.12, -0.15), v3(0.24, -0.12, -0.15)], rings: Array.from({ length: 4 }, () => ({ w: 0.012, f: 0.012, b: 0.012 })), front: v3(0, 0, 1), radial: 6 });
  p.add(crank.geometry, { material: "steel", color: "#2e2a26", matrix: gun });
  p.add(lathe([[0.04, 0], [0.06, 0], [0.06, 0.32], [0.04, 0.34]], 10), { material: "steel", color: "#2e2a26", matrix: mat([0, 0.86, 0.2]) });
  return toGroup(p, "prop.wagon");
}

/** Concord-style stagecoach with a team of two (Stagecoach / Wells Fargo scenes). Faces +Z. */
export function buildStagecoach(): BuiltProp {
  const p = new PartList({ skinned: false });
  // Body: the rounded side profile with a door window, extruded across the coach.
  const side = new Shape();
  side.moveTo(-1.0, 0.25);
  side.quadraticCurveTo(-1.15, 0.0, -0.8, -0.1);
  side.lineTo(0.8, -0.1);
  side.quadraticCurveTo(1.15, 0.0, 1.0, 0.25);
  side.lineTo(0.9, 1.25);
  side.lineTo(-0.9, 1.25);
  side.closePath();
  const win = new Path();
  win.moveTo(-0.3, 0.6);
  win.lineTo(0.3, 0.6);
  win.lineTo(0.3, 1.05);
  win.lineTo(-0.3, 1.05);
  win.closePath();
  side.holes.push(win);
  p.add(extrude(side, 1.3, { size: 0.03, segments: 2 }, 10), { material: "paint", color: "#8a2a1e", matrix: mat([0, 1.0, 0], [0, Math.PI / 2, 0]) });
  // Gold trim lines, roof rail, driver's box, leather boot at the back.
  for (const y of [1.1, 1.85]) p.add(extrude(roundedRect(2.0, 0.04, 0.01), 1.34), { material: "brass", color: "#d8b040", matrix: mat([0, y, 0], [0, Math.PI / 2, 0]) });
  p.add(extrude(roundedRect(1.1, 1.7, 0.05), 0.06, { size: 0.01 }), { material: "wood", color: "#3a2618", matrix: mat([0, 2.28, 0], [Math.PI / 2, 0, 0]) });
  for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) p.add(lathe([[0.012, 0], [0.012, 0.16], [0, 0.16]], 6), { material: "brass", color: "#d8b040", matrix: mat([sx * 0.5, 2.28, -0.75 + i * 0.3]) });
  p.add(extrude(roundedRect(1.2, 0.5, 0.04, 0, 0.25), 0.5, { size: 0.02 }), { material: "wood", color: "#3a2618", matrix: mat([0, 1.5, 1.25]) });
  p.add(extrude(roundedRect(1.1, 0.55, 0.15, 0, 0.27), 0.45, { size: 0.03 }), { material: "leather", color: "#2e1e14", matrix: mat([0, 1.0, -1.25]) });
  // Undercarriage and wheels (smaller in front), then the team on the pole.
  p.add(extrude(roundedRect(0.1, 0.1, 0.01), 2.6), { material: "wood", color: "#3a2a1c", matrix: mat([0, 0.75, 0]) });
  for (const [z, r] of [[-0.9, 0.62], [0.9, 0.48]] as const) {
    p.add(lathe([[0.035, -0.85], [0.035, 0.85], [0, 0.85]], 8), { material: "steel", color: "#2e2a26", matrix: mat([0, r, z], [0, 0, Math.PI / 2]) });
    for (const sx of [-1, 1]) addWheel(p, r, [sx * 0.8, r, z], 12);
  }
  p.add(extrude(roundedRect(0.08, 0.08, 0.01), 2.4), { material: "wood", color: "#5a3a22", matrix: mat([0, 0.7, 2.2]) });
  const built = toGroup(p, "prop.stagecoach");
  for (const sx of [-1, 1]) {
    const horse = buildHorse({ harness: true, coat: sx === 1 ? "#6e4226" : "#3a2418" });
    horse.group.position.set(sx * 0.45, 0, 3.0);
    built.group.add(horse.group);
    built.triangles += horse.triangles;
  }
  return built;
}

/** A dry tumbleweed: a seeded tangle of thin curved twigs around a hollow ball. */
export function buildTumbleweed(seed = 7): BuiltProp {
  const p = new PartList({ skinned: false });
  const r = rng(seed);
  for (let i = 0; i < 26; i++) {
    const pts: Vector3[] = [];
    const a0 = r() * Math.PI * 2;
    const b0 = r() * Math.PI - Math.PI / 2;
    for (let k = 0; k < 6; k++) {
      const a = a0 + k * (0.5 + r() * 0.4);
      const b = b0 + Math.sin(k + i) * 0.6;
      const rad = 0.36 + r() * 0.1;
      pts.push(v3(Math.cos(a) * Math.cos(b) * rad, Math.sin(b) * rad + 0.42, Math.sin(a) * Math.cos(b) * rad));
    }
    const twig = sweep({ path: pts, rings: pts.map(() => ({ w: 0.006, f: 0.006, b: 0.006 })), front: v3(0, 1, 0), radial: 4, samples: 14 });
    p.add(twig.geometry, { material: "wood", color: i % 3 === 0 ? "#b0905a" : "#9a7a48" });
  }
  return toGroup(p, "prop.tumbleweed");
}

/** Beer bottle with a paper label. */
export function buildBottle(): BuiltProp {
  const p = new PartList({ skinned: false });
  p.add(lathe([[0, 0], [0.034, 0], [0.036, 0.01], [0.036, 0.15], [0.03, 0.19], [0.014, 0.23], [0.013, 0.29], [0.016, 0.3], [0, 0.3]], 16), { material: "glass", color: "#3f7a4a" });
  p.add(lathe([[0.0365, 0.05], [0.0368, 0.05], [0.0368, 0.12], [0.0365, 0.12]], 16), { material: "cloth", color: "#e8dcb8" });
  return toGroup(p, "prop.bottle");
}

/** Dynamite: one stick with a curling fuse, or a bundle of three tied with twine. */
export function buildDynamite(bundle = false): BuiltProp {
  const p = new PartList({ skinned: false });
  const stick = lathe([[0, 0], [0.017, 0], [0.019, 0.004], [0.019, 0.196], [0.017, 0.2], [0, 0.2]], 12);
  const at: [number, number][] = bundle ? [[-0.02, 0], [0.02, 0], [0, 0.034]] : [[0, 0]];
  for (const [x, z] of at) p.add(stick, { material: "cloth", color: "#a82a1e", matrix: mat([x, 0, z]) });
  if (bundle) {
    for (const y of [0.05, 0.15]) {
      const band = sweep({ path: Array.from({ length: 12 }, (_, i) => v3(Math.cos((i / 12) * Math.PI * 2) * 0.042, y, 0.011 + Math.sin((i / 12) * Math.PI * 2) * 0.04)), rings: Array.from({ length: 12 }, () => ({ w: 0.003, f: 0.006, b: 0.006 })), front: v3(0, 1, 0), radial: 4, closed: true });
      p.add(band.geometry, { material: "cloth", color: "#c8b080" });
    }
  }
  const fuse = sweep({ path: [v3(0, 0.2, 0), v3(0.01, 0.24, 0.0), v3(0.03, 0.26, 0.01), v3(0.045, 0.25, 0.02)], rings: Array.from({ length: 4 }, () => ({ w: 0.003, f: 0.003, b: 0.003 })), front: v3(0, 0, 1), radial: 5, samples: 8 });
  p.add(fuse.geometry, { material: "cloth", color: "#d8c8a0" });
  return toGroup(p, "prop.dynamite");
}

/** Wrist shackles joined by a short chain (Jail). */
export function buildShackles(): BuiltProp {
  const p = new PartList({ skinned: false });
  const ring = (cx: number, cy: number, rx: number, ry: number, t: number, rotY: number, color: string) => {
    const path = Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2;
      return v3(Math.cos(a) * rx, Math.sin(a) * ry, 0);
    });
    const g = sweep({ path, rings: path.map(() => ({ w: t, f: t, b: t })), front: v3(0, 0, 1), radial: 6, closed: true });
    p.add(g.geometry, { material: "steel", color, matrix: mat([cx, cy, 0], [0, rotY, 0]) });
  };
  ring(-0.12, 0, 0.05, 0.05, 0.012, 0, "#4a4642");
  ring(0.12, 0, 0.05, 0.05, 0.012, 0, "#4a4642");
  for (let i = 0; i < 5; i++) ring(-0.06 + i * 0.03, -0.02 - Math.sin((i / 4) * Math.PI) * 0.03, 0.018, 0.011, 0.004, i % 2 ? Math.PI / 2 : 0, "#3a3632");
  return toGroup(p, "prop.shackles");
}

/** Headstone with a raised cross and a grave mound (eliminated players). */
export function buildGrave(): BuiltProp {
  const p = new PartList({ skinned: false });
  const stone = new Shape();
  stone.moveTo(-0.26, 0);
  stone.lineTo(0.26, 0);
  stone.lineTo(0.26, 0.75);
  stone.quadraticCurveTo(0.26, 1.0, 0, 1.02);
  stone.quadraticCurveTo(-0.26, 1.0, -0.26, 0.75);
  stone.closePath();
  p.add(extrude(stone, 0.12, { size: 0.02 }, 10), { material: "stone", color: "#8d8a84" });
  p.add(extrude(polygon([[-0.03, 0], [0.03, 0], [0.03, 0.16], [0.1, 0.16], [0.1, 0.22], [0.03, 0.22], [0.03, 0.3], [-0.03, 0.3], [-0.03, 0.22], [-0.1, 0.22], [-0.1, 0.16], [-0.03, 0.16]]), 0.02, { size: 0.004 }), { material: "stone", color: "#9e9a92", matrix: mat([0, 0.48, 0.07]) });
  const mound = lathe([[0, 0.16], [0.2, 0.15], [0.38, 0.1], [0.5, 0.03], [0.55, 0]], 18);
  p.add(mound, { material: "stone", color: "#7a5a3a", matrix: mat([0, 0, 0.62], [0, 0, 0], [0.75, 1, 1.25]) });
  return toGroup(p, "prop.grave");
}

/** A plank crate with corner battens (seats show their blue cards on it). Width along X. */
export function buildCrate(width = 1.3, height = 0.5, depth = 0.95): BuiltProp {
  const p = new PartList({ skinned: false });
  const board = 0.16;
  const rows = Math.ceil(height / board);
  for (let i = 0; i < rows; i++) {
    const y = i * board + board / 2;
    const tint = i % 2 === 0 ? "#8b6a43" : "#957450";
    for (const sz of [-1, 1]) p.add(extrude(roundedRect(width, board * 0.94, 0.01), 0.025, { size: 0.004, segments: 1 }, 1), { material: "wood", color: tint, matrix: mat([0, y, sz * (depth / 2)]) });
    for (const sx of [-1, 1]) p.add(extrude(roundedRect(depth, board * 0.94, 0.01), 0.025, { size: 0.004, segments: 1 }, 1), { material: "wood", color: tint, matrix: mat([sx * (width / 2), y, 0], [0, Math.PI / 2, 0]) });
  }
  p.add(extrude(roundedRect(width + 0.02, depth + 0.02, 0.02), 0.03, { size: 0.005, segments: 1 }, 1), { material: "wood", color: "#7a5a38", matrix: mat([0, height + 0.01, 0], [Math.PI / 2, 0, 0]) });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.add(extrude(roundedRect(0.06, height, 0.01, 0, height / 2), 0.06, { size: 0.006, segments: 1 }, 1), { material: "wood", color: "#5e4228", matrix: mat([sx * (width / 2 - 0.01), 0, sz * (depth / 2 + 0.01)]) });
  return toGroup(p, "prop.crate");
}

/** Saguaro cactus: a ribbed trunk with two arms. */
export function buildCactus(seed = 3): BuiltProp {
  const p = new PartList({ skinned: false });
  const r = rng(seed);
  const h = 1.8 + r() * 0.8;
  const ribs = (pp: Vector3, _u: number, a: number) => {
    const k = 1 + 0.08 * Math.cos(a * 12);
    pp.x *= k;
    pp.z *= k;
  };
  const trunk = sweep({ path: [v3(0, 0, 0), v3(0, h * 0.5, 0), v3(0, h, 0)], rings: [{ w: 0.18, f: 0.18, b: 0.18 }, { w: 0.17, f: 0.17, b: 0.17 }, { w: 0.15, f: 0.15, b: 0.15 }], front: v3(0, 0, 1), radial: 16, samples: 8, capEnd: true, deform: ribs });
  p.add(trunk.geometry, { material: "leather", color: "#4e6a3a" });
  for (const sx of [-1, 1]) {
    const y0 = h * (0.35 + r() * 0.2);
    const up = h * (0.25 + r() * 0.2);
    const arm = sweep({
      path: [v3(sx * 0.1, y0, 0), v3(sx * 0.35, y0 + 0.05, 0), v3(sx * 0.42, y0 + 0.25, 0), v3(sx * 0.42, y0 + up, 0)],
      rings: [{ w: 0.1, f: 0.1, b: 0.1 }, { w: 0.1, f: 0.1, b: 0.1 }, { w: 0.095, f: 0.095, b: 0.095 }, { w: 0.08, f: 0.08, b: 0.08 }],
      front: v3(0, 0, 1),
      radial: 12,
      samples: 10,
      capEnd: true,
      deform: ribs,
    });
    p.add(arm.geometry, { material: "leather", color: "#557540" });
  }
  return toGroup(p, "prop.cactus");
}

/** A weathered boulder: a subdivided ball pushed in and out by seeded noise. */
export function buildRock(seed = 5, size = 0.6): BuiltProp {
  const g = new IcosahedronGeometry(size, 2);
  const r = rng(seed);
  const pos = g.getAttribute("position");
  const bumps = Array.from({ length: 6 }, () => v3(r() - 0.5, r() - 0.5, r() - 0.5).normalize());
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    let k = 1;
    for (const b of bumps) k += 0.12 * Math.max(0, n.dot(b)) ** 3 - 0.05;
    v.multiplyScalar(k);
    v.y = Math.max(-size * 0.2, v.y * 0.7);
    pos.setXYZ(i, v.x, v.y + size * 0.2, v.z);
  }
  g.computeVertexNormals();
  const p = new PartList({ skinned: false });
  p.add(g, { material: "stone", color: "#a07a58" });
  return toGroup(p, "prop.rock");
}

export function buildBarrel(): BuiltProp {
  const p = new PartList({ skinned: false });
  p.add(lathe([[0, 0], [0.26, 0], [0.3, 0.2], [0.32, 0.42], [0.3, 0.64], [0.26, 0.84], [0, 0.84]], 16), { material: "wood", color: "#6e4c30" });
  for (const y of [0.12, 0.66]) p.add(lathe([[0.305, 0], [0.318, 0], [0.318, 0.045], [0.305, 0.045]], 16), { material: "steel", color: "#3a3a3a", matrix: mat([0, y, 0]) });
  return toGroup(p, "prop.barrel");
}

