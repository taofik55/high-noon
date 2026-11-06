import {
  BackSide,
  Color,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Path,
  PlaneGeometry,
  Shape,
  Vector3,
  type BufferGeometry,
  type ColorRepresentation,
} from "three";
import { InstanceSet } from "../core/instances";
import { PartList, triangleCount } from "../core/parts";
import { extrude, lathe, mat, polygon, roundedRect } from "../core/shapes";
import { isMaterialKey, material, type MaterialKey } from "../materials";
import { bracketShape, cornice, plankGeometry, prototype, signTexture, type BuiltBuilding, type Opening } from "./kit";

// One building's parts and instance sets, plus helpers that work in a "frame": a Matrix4 placing a wall, awning
// or roof (local x along it, y up, +z out of its face). Every building in town is assembled from these.

export const TRIM_COLOR = "#e2d3b0";

const noise = (i: number) => {
  const n = Math.sin(i * 12.9898) * 43758.5453;
  return n - Math.floor(n);
};
export const tint = (base: string, i: number, amount = 0.08) => new Color(base).multiplyScalar(1 - amount + noise(i) * amount * 2);

const frameAt = (frame: Matrix4, local: Matrix4) => frame.clone().multiply(local);

export class Kit {
  readonly parts = new PartList({ skinned: false });
  private readonly sets = new Map<string, InstanceSet>();
  private readonly panes: Matrix4[] = [];
  private readonly extras: Mesh[] = [];
  private seq = 0;

  add(g: BufferGeometry, key: MaterialKey, color: ColorRepresentation, m?: Matrix4): void {
    this.parts.add(g, { material: key, color, matrix: m });
  }

  /** An instance set by name, created on first use. */
  set(name: string, make: () => BufferGeometry, key: MaterialKey): InstanceSet {
    let s = this.sets.get(name);
    if (!s) {
      s = new InstanceSet(name, make(), material(key));
      this.sets.set(name, s);
    }
    return s;
  }

  /** A plank (1 m along X, 1 m along Y, 34 mm thick) scaled by the matrix, painted or bare. */
  plank(m: Matrix4, color: ColorRepresentation, key: "paint" | "wood" = "paint"): void {
    this.set(`planks.${key}`, plankGeometry, key).add(m, color);
  }

  pane(m: Matrix4): void {
    this.panes.push(m);
  }

  /** A painted sign face with lettering (the only per-building texture). */
  sign(text: string, w: number, h: number, m: Matrix4, colors?: { ground: string; ink: string }): void {
    const tex = signTexture(text, colors, w / h);
    const mesh = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map: tex, color: tex ? "#ffffff" : (colors?.ground ?? "#e6d6ae"), roughness: 0.8 }));
    mesh.applyMatrix4(m);
    mesh.name = `sign.${text}`;
    this.extras.push(mesh);
  }

  /** A mesh with its own material (interior shells). */
  mesh(mesh: Mesh): void {
    this.extras.push(mesh);
  }

  /** A running number for colour variation. */
  next(): number {
    return this.seq++;
  }

  build(name: string): BuiltBuilding {
    const group = new Group();
    group.name = name;
    let triangles = 0;
    let drawCalls = 0;
    for (const [key, geometry] of this.parts.build()) {
      if (!isMaterialKey(key)) continue;
      const mesh = new Mesh(geometry, material(key));
      mesh.name = `${name}.${key}`;
      mesh.castShadow = key !== "glass";
      mesh.receiveShadow = true;
      group.add(mesh);
      triangles += triangleCount(geometry);
      drawCalls++;
    }
    if (this.panes.length) {
      const set = new InstanceSet(`${name}.glass`, prototype(new PlaneGeometry(1, 1)), material("glass"));
      for (const m of this.panes) set.add(m, "#40342a");
      this.sets.set("__glass", set);
    }
    for (const set of this.sets.values()) {
      if (set.count === 0) continue;
      const mesh = set.build();
      if (set.name.endsWith(".glass")) mesh.castShadow = false;
      group.add(mesh);
      triangles += triangleCount(mesh.geometry) * set.count;
      drawCalls++;
    }
    for (const e of this.extras) {
      group.add(e);
      triangles += triangleCount(e.geometry);
      drawCalls++;
    }
    return { group, triangles, drawCalls };
  }
}

export interface WallSpec {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  openings?: readonly Opening[];
  color: string;
  style?: "lap" | "batten";
  key?: "paint" | "wood";
}

/** Siding on a wall face (frame z = 0), split around openings. Lap boards lean out at the bottom. */
export function siding(kit: Kit, frame: Matrix4, w: WallSpec): void {
  const key = w.key ?? "paint";
  const cutsAlong = (a: number, b: number) =>
    (w.openings ?? [])
      .filter((o) => b > o.y && a < o.y + o.h)
      .map((o) => [o.x - o.w / 2 - 0.1, o.x + o.w / 2 + 0.1] as const)
      .sort((p, q) => p[0] - q[0]);
  const cutsUp = (a: number, b: number) =>
    (w.openings ?? [])
      .filter((o) => b > o.x - o.w / 2 && a < o.x + o.w / 2)
      .map((o) => [o.y - 0.1, o.y + o.h + 0.1] as const)
      .sort((p, q) => p[0] - q[0]);
  if ((w.style ?? "lap") === "lap") {
    const H = 0.19;
    for (let y = w.y0; y < w.y1 - 0.02; y += H) {
      const h = Math.min(H, w.y1 - y);
      let x = w.x0;
      for (const [a, b] of [...cutsAlong(y, y + h), [w.x1, w.x1] as const]) {
        const end = Math.min(a, w.x1);
        if (end - x > 0.05) kit.plank(frameAt(frame, mat([(x + end) / 2, y + h / 2, 0.02], [-0.07, 0, 0], [end - x, h * 1.06, 1])), tint(w.color, kit.next()), key);
        x = Math.max(x, b);
      }
    }
    return;
  }
  // Board and batten: vertical boards, with narrow battens over the seams.
  const B = 0.24;
  for (let x = w.x0 + B / 2; x < w.x1; x += B) {
    let y = w.y0;
    for (const [a, b] of [...cutsUp(x - B / 2, x + B / 2), [w.y1, w.y1] as const]) {
      const top = Math.min(a, w.y1);
      if (top - y > 0.05) {
        kit.plank(frameAt(frame, mat([x, (y + top) / 2, 0.015], [0, 0, Math.PI / 2], [top - y, B * 0.98, 1])), tint(w.color, kit.next()), key);
        kit.plank(frameAt(frame, mat([x + B / 2, (y + top) / 2, 0.045], [0, 0, Math.PI / 2], [top - y, 0.055, 1])), tint(w.color, kit.next(), 0.12), key);
      }
      y = Math.max(y, b);
    }
  }
}

/** Solid backing behind siding, with real holes so openings show the dark interior. */
export function backing(kit: Kit, frame: Matrix4, w: number, h: number, openings: readonly Opening[], color: string, outline?: Shape): void {
  const s = outline ?? roundedRect(w, h, 0.01, 0, h / 2);
  for (const o of openings) s.holes.push(roundedRect(o.w, o.h, 0.01, o.x, o.y + o.h / 2) as unknown as Path);
  kit.add(extrude(s, 0.1, undefined, 12), "paint", color, frameAt(frame, mat([0, 0, -0.06])));
}

/** Stone wall of staggered, bevelled blocks (instanced); rows are cut around openings like siding. */
export function stoneWall(kit: Kit, frame: Matrix4, w: WallSpec & { block?: [number, number] }): void {
  const [bw, bh] = w.block ?? [0.62, 0.3];
  const blocks = kit.set("stones", () => prototype(extrude(roundedRect(1, 1, 0.08), 0.16, { size: 0.025, segments: 1 }, 2)), "stone");
  let row = 0;
  for (let y = w.y0; y < w.y1 - 0.02; y += bh, row++) {
    const h = Math.min(bh, w.y1 - y);
    const cuts = (w.openings ?? [])
      .filter((o) => y + h > o.y + 0.02 && y < o.y + o.h - 0.02)
      .map((o) => [o.x - o.w / 2 - 0.12, o.x + o.w / 2 + 0.12] as const)
      .sort((p, q) => p[0] - q[0]);
    let x0 = w.x0;
    for (const [a, b] of [...cuts, [w.x1, w.x1] as const]) {
      const x1 = Math.min(a, w.x1);
      // Lay blocks across [x0, x1], staggered by row; the end pieces are cut to fit.
      for (let x = x0 - (row % 2) * bw * 0.5; x < x1; x += bw) {
        const l = Math.max(x, x0);
        const r = Math.min(x + bw, x1);
        if (r - l < 0.06) continue;
        blocks.add(frameAt(frame, mat([(l + r) / 2, y + h / 2, 0.05], [0, 0, 0], [(r - l) * 0.96, h * 0.92, 1])), tint(w.color, kit.next(), 0.14));
      }
      x0 = Math.max(x0, b);
    }
  }
  // Lintels and sills of dressed stone around each opening.
  for (const o of w.openings ?? []) {
    kit.add(extrude(roundedRect(o.w + 0.3, 0.22, 0.02), 0.2, { size: 0.02 }), "stone", tint(w.color, kit.next(), 0.05), frameAt(frame, mat([o.x, o.y + o.h + 0.11, 0.06])));
    if (o.kind === "window") kit.add(extrude(roundedRect(o.w + 0.3, 0.1, 0.02), 0.24, { size: 0.02 }), "stone", tint(w.color, kit.next(), 0.05), frameAt(frame, mat([o.x, o.y - 0.05, 0.08])));
    for (const sx of [-1, 1]) kit.add(extrude(roundedRect(0.12, o.h, 0.02, 0, o.h / 2), 0.2, { size: 0.015 }), "stone", tint(w.color, kit.next(), 0.05), frameAt(frame, mat([o.x + sx * (o.w / 2 + 0.06), o.y, 0.06])));
  }
}

export interface TrimSpec {
  trim?: string;
  pediment?: boolean;
  shutters?: string;
  bars?: boolean;
  doorColor?: string;
}

/** Casing, head, sill and fill (sashes and glass, a panelled door, iron bars) for one opening in a wall frame. */
export function opening(kit: Kit, frame: Matrix4, o: Opening, t: TrimSpec = {}): void {
  const trim = t.trim ?? TRIM_COLOR;
  const cx = o.x;
  const cy = o.y + o.h / 2;
  const at = (x: number, y: number, z: number, rot: [number, number, number] = [0, 0, 0], s: number | [number, number, number] = 1) => frameAt(frame, mat([x, y, z], rot, s));
  const casing = roundedRect(o.w + 0.24, o.h + 0.24, 0.01, 0, 0);
  casing.holes.push(roundedRect(o.w, o.h, 0.005) as unknown as Path);
  kit.add(extrude(casing, 0.06, { size: 0.01 }), "paint", trim, at(cx, cy, 0.08));
  kit.add(cornice(o.w + 0.4, 0.5), "paint", trim, at(cx, o.y + o.h + 0.1, 0.07));
  if (t.pediment) kit.add(extrude(polygon([[-(o.w + 0.34) / 2, 0], [(o.w + 0.34) / 2, 0], [0, 0.2]]), 0.06, { size: 0.01 }), "paint", trim, at(cx, o.y + o.h + 0.24, 0.09));
  if (o.kind === "window") {
    kit.add(extrude(polygon([[-(o.w + 0.36) / 2, 0], [(o.w + 0.36) / 2, 0], [(o.w + 0.3) / 2, 0.06], [-(o.w + 0.3) / 2, 0.06]]), 0.18, { size: 0.01 }), "paint", trim, at(cx, o.y - 0.12, 0.12));
    const bar = (w: number, h: number, x: number, y: number) => kit.add(extrude(roundedRect(w, h, 0.004), 0.04), "paint", trim, at(cx + x, cy + y, 0.02));
    bar(o.w, 0.045, 0, 0);
    bar(0.035, o.h, 0, 0);
    if (o.h > 1) {
      bar(o.w, 0.03, 0, o.h / 4);
      bar(o.w, 0.03, 0, -o.h / 4);
    }
    kit.pane(at(cx, cy, -0.005, [0, 0, 0], [o.w, o.h, 1]));
    if (t.bars) {
      const rod = kit.set("bars", () => prototype(lathe([[0.016, 0], [0.016, 1], [0, 1]], 6)), "steel");
      const n = Math.max(3, Math.round(o.w / 0.12));
      for (let i = 0; i < n; i++) rod.add(at(cx - o.w / 2 + ((i + 0.5) * o.w) / n, o.y, 0.1, [0, 0, 0], [1, o.h, 1]), "#2c2c2c");
      kit.add(extrude(roundedRect(o.w + 0.06, 0.05, 0.01), 0.05), "steel", "#2c2c2c", at(cx, o.y + o.h * 0.5, 0.1));
    }
    if (t.shutters) {
      for (const sx of [-1, 1]) {
        const sw = o.w / 2;
        const f = roundedRect(sw, o.h, 0.01);
        f.holes.push(roundedRect(sw - 0.1, o.h - 0.12, 0.005) as unknown as Path);
        const x = cx + sx * (o.w / 2 + 0.13 + sw / 2);
        kit.add(extrude(f, 0.05, { size: 0.006 }), "paint", t.shutters, at(x, cy, 0.1));
        const slats = Math.max(4, Math.round((o.h - 0.24) / 0.15));
        for (let k = 0; k <= slats; k++) kit.add(extrude(roundedRect(sw - 0.1, 0.11, 0.01), 0.02), "paint", t.shutters, at(x, o.y + 0.12 + (k * (o.h - 0.24)) / slats, 0.1, [-0.6, 0, 0]));
      }
    }
    return;
  }
  // Doors: a panelled leaf with a glazed upper panel and a brass knob.
  const leaf = roundedRect(o.w - 0.04, o.h - 0.04, 0.01);
  leaf.holes.push(roundedRect(o.w - 0.3, o.h * 0.34, 0.02, 0, o.h * 0.2) as unknown as Path);
  leaf.holes.push(roundedRect(o.w - 0.3, o.h * 0.34, 0.02, 0, -o.h * 0.22) as unknown as Path);
  const door = t.doorColor ?? "#4a2a1c";
  kit.add(extrude(leaf, 0.05, { size: 0.008 }), "paint", door, at(cx, cy, -0.02));
  kit.add(extrude(roundedRect(o.w - 0.3, o.h * 0.34, 0.02), 0.02), "glass", "#3b2a1a", at(cx, cy + o.h * 0.2, -0.03));
  kit.add(extrude(roundedRect(o.w - 0.3, o.h * 0.34, 0.02), 0.03), "paint", new Color(door).multiplyScalar(1.15), at(cx, cy - o.h * 0.22, -0.03));
  kit.add(lathe([[0, 0], [0.025, 0], [0.025, 0.01], [0.012, 0.03], [0, 0.03]], 8), "brass", "#b08a4a", at(cx + o.w / 2 - 0.12, o.y + 1.0, 0.03, [Math.PI / 2, 0, 0]));
}

/** Boardwalk: planks running out from a wall frame over `depth` metres, on a dark skirt board. */
export function boardwalk(kit: Kit, frame: Matrix4, x0: number, x1: number, depth: number, deckY: number): void {
  for (let x = x0 + 0.08; x < x1; x += 0.155) kit.plank(frameAt(frame, mat([x, deckY - 0.017, depth / 2], [0, Math.PI / 2, 0], [depth, 0.145, 1])), tint("#8a6a4a", kit.next(), 0.14), "wood");
  kit.add(extrude(roundedRect(x1 - x0 + 0.1, 0.25, 0.01), depth, undefined, 2), "wood", "#5e4a36", frameAt(frame, mat([(x0 + x1) / 2, deckY - 0.17, depth / 2])));
}

/** Stepped shingle panel (courses whose butt edges face the low end), `length` along X before placement. */
function shinglePanel(length: number, width: number, course = 0.24): BufferGeometry {
  const n = Math.ceil(length / course);
  const s = new Shape();
  s.moveTo(0, 0);
  s.lineTo(n * course, 0);
  for (let i = n - 1; i >= 0; i--) {
    s.lineTo(i * course + course, 0.014);
    s.lineTo(i * course + 0.004, 0.046);
    s.lineTo(i * course, 0.046);
  }
  s.closePath();
  return extrude(s, width, undefined, 1);
}

/** A porch roof sloping out from a wall (at height yWall) over `depth` metres, on square posts with brackets. */
export function awning(kit: Kit, frame: Matrix4, x0: number, x1: number, depth: number, yWall: number, posts: number, color: string, deckY = 0): void {
  const drop = 0.45;
  const slope = Math.hypot(depth, drop) + 0.1;
  const tilt = Math.atan2(drop, depth);
  // Panel x runs down the slope (away from the wall), panel z along the wall.
  const basis = new Matrix4().makeBasis(new Vector3(0, -Math.sin(tilt), Math.cos(tilt)), new Vector3(0, Math.cos(tilt), Math.sin(tilt)), new Vector3(1, 0, 0));
  basis.setPosition((x0 + x1) / 2, yWall, 0);
  kit.add(shinglePanel(slope, x1 - x0 + 0.2, 0.22), "wood", "#5e4a3a", frame.clone().multiply(basis));
  kit.add(extrude(roundedRect(x1 - x0 + 0.2, 0.16, 0.01), 0.05), "paint", color, frameAt(frame, mat([(x0 + x1) / 2, yWall - drop - 0.04, depth + 0.02])));
  const postH = yWall - drop - deckY;
  const post = extrude(roundedRect(0.13, postH, 0.015, 0, postH / 2), 0.13, { size: 0.012 }, 2);
  const brackets = kit.set("brackets.small", () => prototype(extrude(bracketShape(0.32), 0.06, { size: 0.006, segments: 1 }, 4)), "paint");
  for (let i = 0; i < posts; i++) {
    const x = x0 + 0.1 + (i * (x1 - x0 - 0.2)) / Math.max(1, posts - 1);
    kit.add(post, "paint", color, frameAt(frame, mat([x, deckY, depth - 0.08])));
    for (const sx of [-1, 1]) brackets.add(frameAt(frame, mat([x + sx * 0.065, yWall - drop - 0.36, depth - 0.08], [0, sx === 1 ? 0 : Math.PI, 0])), color);
  }
}

/** Gable roof with the ridge along frame z: two shingle panels, ridge cap, fascia, optional gable ends. */
export function gableRoof(kit: Kit, frame: Matrix4, w: number, d: number, eave: number, pitch: number, wallColor: string, gables = true): void {
  const halfW = w / 2 + 0.3;
  const slope = halfW / Math.cos(pitch) + 0.08;
  const panel = shinglePanel(slope, d + 0.4);
  const c = Math.cos(pitch);
  const sn = Math.sin(pitch);
  for (const sx of [-1, 1]) {
    const m = new Matrix4().makeBasis(new Vector3(-sx * c, sn, 0), new Vector3(sx * sn, c, 0), new Vector3(0, 0, 1));
    m.setPosition(sx * halfW, eave + 0.05, 0);
    kit.add(panel, "wood", "#5e4a3a", frame.clone().multiply(m));
    kit.add(extrude(roundedRect(0.05, 0.2, 0.01), d + 0.45, undefined, 1), "paint", TRIM_COLOR, frameAt(frame, mat([sx * (halfW + 0.02), eave - 0.02, 0])));
  }
  kit.add(extrude(polygon([[-0.16, 0], [0.16, 0], [0, 0.09]]), d + 0.5, undefined, 1), "wood", "#4f3f30", frameAt(frame, mat([0, eave + 0.07 + halfW * Math.tan(pitch), 0])));
  if (gables) {
    const tri = extrude(polygon([[-w / 2, 0], [w / 2, 0], [0, (w / 2) * Math.tan(pitch)]]), 0.1);
    for (const sz of [-1, 1]) kit.add(tri, "paint", wallColor, frameAt(frame, mat([0, eave, sz * (d / 2 - 0.02)])));
  }
}

/** A sign board with a moulded frame; lettering painted on a canvas. */
export function signBoard(kit: Kit, frame: Matrix4, text: string, cx: number, cy: number, w: number, h: number, colors?: { ground: string; ink: string }): void {
  const f = roundedRect(w + 0.2, h + 0.2, 0.04);
  f.holes.push(roundedRect(w, h, 0.02) as unknown as Path);
  kit.add(extrude(f, 0.08, { size: 0.015 }), "paint", TRIM_COLOR, frameAt(frame, mat([cx, cy, 0.12])));
  kit.sign(text, w, h, frameAt(frame, mat([cx, cy, 0.11])), colors);
}

/** Dark inward-facing interior shell, seen only through openings. */
export function interior(kit: Kit, w: number, h: number, d: number, at: [number, number, number]): void {
  const mesh = new Mesh(extrude(roundedRect(w, h, 0.001), d, undefined, 1), new MeshStandardMaterial({ color: "#24180f", roughness: 1, side: BackSide }));
  mesh.position.set(at[0], at[1] + h / 2, at[2]);
  mesh.name = "interior";
  kit.mesh(mesh);
}

export { frameAt };
