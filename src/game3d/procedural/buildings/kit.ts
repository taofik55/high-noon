import { CanvasTexture, SRGBColorSpace, Shape, Path, type BufferGeometry, type ColorRepresentation, type Group } from "three";
import { PartList } from "../core/parts";
import { extrude, mat, polygon, roundedRect } from "../core/shapes";

// Building kit: the pieces every Western building is made of (planks, mouldings, brackets, turned posts, signs).
// The saloon introduced them; the other buildings reuse them so the town reads as one place.

export interface Opening {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "door" | "window" | "batwing";
}

/** A prototype geometry with the colour attribute the shared vertex-colour materials expect. */
export function prototype(g: BufferGeometry, color: ColorRepresentation = "#ffffff"): BufferGeometry {
  const parts = new PartList({ skinned: false });
  parts.add(g, { material: "x", color });
  return parts.build().get("x") as BufferGeometry;
}

/** A plank 1 m long along X with rounded edges (scaled per instance). */
export function plankGeometry(): BufferGeometry {
  // Chamfered section (8 points): edges still catch the light, at a third of a rounded section's triangles.
  const c = 0.008;
  const section = polygon([
    [-0.017 + c, -0.5],
    [0.017 - c, -0.5],
    [0.017, -0.5 + c],
    [0.017, 0.5 - c],
    [0.017 - c, 0.5],
    [-0.017 + c, 0.5],
    [-0.017, 0.5 - c],
    [-0.017, -0.5 + c],
  ]);
  const g = extrude(section, 1, undefined, 1);
  // Section in XY (thickness × width), extruded along Z → turn so length runs along X.
  g.applyMatrix4(mat([0, 0, 0], [0, Math.PI / 2, 0]));
  return prototype(g);
}

/** Classical moulding profile (fillet, cove, fascia) for cornices, in the YZ plane of a run along X. */
export function mouldingShape(scale: number): Shape {
  const s = new Shape();
  const p: [number, number][] = [
    [0, 0],
    [0.06, 0],
    [0.06, 0.04],
    [0.1, 0.07],
    [0.16, 0.12],
    [0.2, 0.2],
    [0.24, 0.22],
    [0.24, 0.27],
    [0, 0.27],
  ];
  p.forEach(([x, y], i) => (i === 0 ? s.moveTo(x * scale, y * scale) : s.lineTo(x * scale, y * scale)));
  s.closePath();
  return s;
}

/** A cornice run of `length` along X, profile facing +Z. */
export function cornice(length: number, scale: number): BufferGeometry {
  const g = extrude(mouldingShape(scale), length, undefined, 2);
  // Profile drawn as (depth out, height); extruded along Z → rotate so the run is along X and depth points to +Z.
  g.applyMatrix4(mat([0, 0, 0], [0, -Math.PI / 2, 0]));
  return g;
}

/** Scroll bracket outline (drawn in the side plane: x = out from the wall, y = up). */
export function bracketShape(size: number): Shape {
  const s = new Shape();
  s.moveTo(0, 0);
  s.lineTo(0, size);
  s.lineTo(size * 0.75, size);
  s.bezierCurveTo(size * 0.75, size * 0.55, size * 0.45, size * 0.55, size * 0.35, size * 0.35);
  s.bezierCurveTo(size * 0.25, size * 0.15, size * 0.15, 0.0, 0, 0);
  const hole = new Path();
  hole.absarc(size * 0.42, size * 0.72, size * 0.12, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return s;
}

export function turnedProfile(h: number, r: number): [number, number][] {
  // Base block, torus, long shaft with a swell, collar, capital.
  return [
    [0, 0],
    [r * 1.35, 0],
    [r * 1.35, h * 0.06],
    [r * 1.05, h * 0.075],
    [r * 1.2, h * 0.09],
    [r * 0.8, h * 0.11],
    [r * 0.92, h * 0.35],
    [r * 0.8, h * 0.7],
    [r * 1.05, h * 0.82],
    [r * 0.85, h * 0.85],
    [r * 0.95, h * 0.9],
    [r * 1.35, h * 0.94],
    [r * 1.35, h],
    [0, h],
  ];
}

export function signTexture(text: string, colors?: { ground: string; ink: string }, aspect = 5.33): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  // Match the board's proportions so letters are never stretched.
  c.width = 1024;
  c.height = Math.max(96, Math.round(1024 / aspect));
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = colors?.ground ?? "#e6d6ae";
  ctx.fillRect(0, 0, c.width, c.height);
  // Weathering streaks.
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(90,60,30,${0.03 + (i % 5) * 0.01})`;
    ctx.fillRect((i * 97) % c.width, 0, 3 + (i % 4), c.height);
  }
  const ink = colors?.ink ?? "#5a1d14";
  const spaced = text.length <= 8 ? text.split("").join(" ") : text;
  // Largest serif face that fits both the height and the width (minus a margin for the border).
  let size = Math.floor(c.height * 0.62);
  ctx.font = `bold ${size}px Georgia, 'Times New Roman', serif`;
  const width = ctx.measureText(spaced).width;
  if (width > c.width - 90) size = Math.floor((size * (c.width - 90)) / width);
  ctx.font = `bold ${size}px Georgia, 'Times New Roman', serif`;
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(spaced, c.width / 2, c.height / 2 + size * 0.05);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, c.width - 28, c.height - 28);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export interface BuiltBuilding {
  group: Group;
  triangles: number;
  drawCalls: number;
}

/** Hidden interior shell: never seen from outside except through openings, so a plain box is right here. */
export function prototypeBox(w: number, h: number, d: number): BufferGeometry {
  const s = roundedRect(w, h, 0.001);
  return extrude(s, d, undefined, 1);
}
