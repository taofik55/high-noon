import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Vector3 } from "three";

/**
 * One cross-section of a sweep, in the section's own frame: `w` = half width to each side, `f` / `b` = depth to the
 * front / back (different values give chests, calves, boot toes), `p` = superellipse exponent (2 = ellipse,
 * higher = boxier), `ox` / `oz` shift the section within its frame. `gap` opens the ring at the front (radians each
 * side of the front direction), for open clothing like vests and coats.
 */
export interface Ring {
  w: number;
  f: number;
  b: number;
  p?: number;
  ox?: number;
  oz?: number;
  gap?: number;
  /** With `gap`: cover only this many radians next to the opening (a lapel or facing strip) instead of the rest. */
  span?: number;
}

export interface SweepOptions {
  /** Centre line. With `samples`, it is smoothed through a Catmull-Rom curve. */
  path: readonly Vector3[];
  /** One ring per path point; interpolated smoothly between points. */
  rings: readonly Ring[];
  /** Direction the ring's front (`f`) faces, projected perpendicular to the path. One for all, or one per point. */
  front: Vector3 | readonly Vector3[];
  radial?: number;
  /** Total ring count after smoothing (defaults to the path length, i.e. no smoothing). */
  samples?: number;
  capStart?: boolean;
  capEnd?: boolean;
  /** Closed loop (belts, hat bands): the last ring connects back to the first. */
  closed?: boolean;
  /** Which edge of the opening a `span` strip follows: 1 = the +S side, -1 = the -S side. */
  spanSide?: 1 | -1;
  /** Per-vertex deformation after the ring is placed (u = 0..1 along the sweep, a = angle around it). */
  deform?: (p: Vector3, u: number, a: number) => void;
}

export interface SweepResult {
  geometry: BufferGeometry;
  /** For each vertex: position along the sweep 0..1 (used for skin weights and colour gradients). */
  along: Float32Array;
  /** For each vertex: angle around the sweep, 0 = side (+S), PI/2 = front. */
  around: Float32Array;
}

const catmull = (p0: number, p1: number, p2: number, p3: number, t: number): number => {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};

function ringAt(rings: readonly Ring[], x: number): Ring {
  const n = rings.length;
  const i = Math.min(n - 2, Math.max(0, Math.floor(x)));
  const t = Math.min(1, Math.max(0, x - i));
  const r0 = rings[Math.max(0, i - 1)] as Ring;
  const r1 = rings[i] as Ring;
  const r2 = rings[Math.min(n - 1, i + 1)] as Ring;
  const r3 = rings[Math.min(n - 1, i + 2)] as Ring;
  const lerpKey = (k: keyof Ring, def: number) =>
    Math.max(0, catmull(r0[k] ?? def, r1[k] ?? def, r2[k] ?? def, r3[k] ?? def, t));
  const signedKey = (k: "ox" | "oz") => catmull(r0[k] ?? 0, r1[k] ?? 0, r2[k] ?? 0, r3[k] ?? 0, t);
  return {
    w: lerpKey("w", 0),
    f: lerpKey("f", 0),
    b: lerpKey("b", 0),
    p: Math.max(1.2, lerpKey("p", 2)),
    ox: signedKey("ox"),
    oz: signedKey("oz"),
    gap: lerpKey("gap", 0),
    span: lerpKey("span", 0),
  };
}

/** Superellipse point of a ring at angle `a` (0 = side, PI/2 = front). */
export function ringPoint(r: Ring, a: number): [number, number] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const e = 2 / (r.p ?? 2);
  const x = r.w * Math.sign(c) * Math.abs(c) ** e;
  const z = (s >= 0 ? r.f : r.b) * Math.sign(s) * Math.abs(s) ** e;
  return [x + (r.ox ?? 0), z + (r.oz ?? 0)];
}

/**
 * Lofts superellipse rings along a path: the workhorse for limbs, torsos, boots, hat crowns and finger shapes, where
 * plain cylinders would read as primitives. Rings stay perpendicular to the path; the `front` hint fixes their roll.
 */
export function sweep(o: SweepOptions): SweepResult {
  const radial = o.radial ?? 12;
  const n = o.path.length;
  const samples = Math.max(2, o.samples ?? n);
  const curve = o.samples ? new CatmullRomCurve3([...o.path], o.closed ?? false, "catmullrom", 0.5) : null;
  const fronts = Array.isArray(o.front) ? (o.front as Vector3[]) : null;
  const hasGap = o.rings.some((r) => (r.gap ?? 0) > 0 || (r.span ?? 0) > 0);
  const strip = o.rings.some((r) => (r.span ?? 0) > 0);
  const perRing = hasGap ? radial + 1 : radial;

  const positions: number[] = [];
  const uvs: number[] = [];
  const along: number[] = [];
  const around: number[] = [];
  const centres: Vector3[] = [];
  const T = new Vector3();
  const F = new Vector3();
  const S = new Vector3();
  const P = new Vector3();
  let length = 0;
  let prev: Vector3 | null = null;

  for (let j = 0; j < samples; j++) {
    const u = o.closed ? j / samples : j / (samples - 1);
    const x = o.closed ? u * n : u * (n - 1);
    const centre = curve ? curve.getPoint(u) : (o.path[j] as Vector3).clone();
    // Tangent from the curve, or from the neighbouring points (central difference keeps joints smooth).
    if (curve) curve.getTangent(Math.min(0.9999, Math.max(0.0001, u)), T);
    else {
      const a = o.path[o.closed ? (j - 1 + n) % n : Math.max(0, j - 1)] as Vector3;
      const b = o.path[o.closed ? (j + 1) % n : Math.min(n - 1, j + 1)] as Vector3;
      T.subVectors(b, a);
    }
    T.normalize();
    const hint = fronts ? (fronts[Math.min(fronts.length - 1, Math.round(x))] as Vector3) : (o.front as Vector3);
    F.copy(hint).addScaledVector(T, -hint.dot(T)).normalize();
    S.crossVectors(T, F).normalize();
    const ring = ringAt(o.rings, x);
    const gap = ring.gap ?? 0;
    // Angles grow from the front toward -S; a strip on the +S edge runs backwards from the other side of the gap.
    const span = strip ? (ring.span ?? 0) : Math.PI * 2 - 2 * gap;
    const start = strip && o.spanSide === 1 ? Math.PI / 2 - gap - span : Math.PI / 2 + gap;
    if (prev) length += prev.distanceTo(centre);
    prev = centre;
    centres.push(centre);
    for (let k = 0; k < perRing; k++) {
      const a = hasGap ? start + (span * k) / radial : (Math.PI * 2 * k) / radial;
      const [px, pz] = ringPoint(ring, a);
      P.copy(centre).addScaledVector(S, px).addScaledVector(F, pz);
      o.deform?.(P, u, a);
      positions.push(P.x, P.y, P.z);
      uvs.push(k / radial, length);
      along.push(u);
      around.push(a);
    }
  }

  const index: number[] = [];
  const ringCount = o.closed ? samples : samples - 1;
  for (let j = 0; j < ringCount; j++) {
    const j2 = (j + 1) % samples;
    for (let k = 0; k < radial; k++) {
      const k2 = hasGap ? k + 1 : (k + 1) % radial;
      const a = j * perRing + k;
      const b = j * perRing + k2;
      const c = j2 * perRing + k;
      const d = j2 * perRing + k2;
      index.push(a, c, b, b, c, d);
    }
  }

  const addCap = (j: number, flip: boolean) => {
    const c = centres[j] as Vector3;
    const ci = positions.length / 3;
    positions.push(c.x, c.y, c.z);
    uvs.push(0.5, 0.5);
    along.push(j === 0 ? 0 : 1);
    around.push(0);
    for (let k = 0; k < radial; k++) {
      const a = j * perRing + k;
      const b = j * perRing + ((k + 1) % radial);
      if (flip) index.push(ci, a, b);
      else index.push(ci, b, a);
    }
  };
  if (!hasGap && !o.closed) {
    if (o.capStart) addCap(0, true);
    if (o.capEnd) addCap(samples - 1, false);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return { geometry, along: new Float32Array(along), around: new Float32Array(around) };
}
