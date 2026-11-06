import { Euler, ExtrudeGeometry, LatheGeometry, Matrix4, Quaternion, Shape, Vector2, Vector3, type BufferGeometry } from "three";

// Small helpers around three's Extrude/Lathe geometry, used for every hard-surface detail (guns, buckles, trim).

export interface BevelSpec {
  size: number;
  thickness?: number;
  segments?: number;
}

/** Extrudes a 2D outline (XY) along Z, centred on z = 0, optionally bevelled so edges catch light. */
export function extrude(shape: Shape, depth: number, bevel?: BevelSpec, curveSegments = 8): BufferGeometry {
  const g = new ExtrudeGeometry(shape, {
    depth: Math.max(0.0001, depth - (bevel ? 2 * (bevel.thickness ?? bevel.size) : 0)),
    bevelEnabled: !!bevel,
    bevelSize: bevel?.size ?? 0,
    bevelThickness: bevel?.thickness ?? bevel?.size ?? 0,
    bevelSegments: bevel?.segments ?? 2,
    curveSegments,
  });
  g.translate(0, 0, -(depth - (bevel ? 2 * (bevel.thickness ?? bevel.size) : 0)) / 2);
  return g;
}

/** Lathe around +Y from a profile of [radius, y] points (bottom to top). */
export function lathe(profile: readonly (readonly [number, number])[], segments = 16, phiStart = 0, phiLength = Math.PI * 2): BufferGeometry {
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(Math.max(0, r), y)),
    segments,
    phiStart,
    phiLength,
  );
}

export function roundedRect(w: number, h: number, r: number, cx = 0, cy = 0): Shape {
  const s = new Shape();
  const x = cx - w / 2;
  const y = cy - h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rr);
  s.lineTo(x + w, y + h - rr);
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  s.lineTo(x + rr, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rr);
  s.lineTo(x, y + rr);
  s.quadraticCurveTo(x, y, x + rr, y);
  return s;
}

/** A closed outline through points (straight segments). */
export function polygon(points: readonly (readonly [number, number])[]): Shape {
  const s = new Shape();
  points.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  return s;
}

/** Translation · rotation (Euler XYZ, radians) · scale. */
export function mat(pos: readonly [number, number, number] = [0, 0, 0], rot: readonly [number, number, number] = [0, 0, 0], scale: number | readonly [number, number, number] = 1): Matrix4 {
  const s = typeof scale === "number" ? new Vector3(scale, scale, scale) : new Vector3(...scale);
  return new Matrix4().compose(new Vector3(...pos), new Quaternion().setFromEuler(new Euler(...rot)), s);
}

export const v3 = (x: number, y: number, z: number) => new Vector3(x, y, z);
