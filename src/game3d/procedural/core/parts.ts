import { BufferGeometry, Color, Float32BufferAttribute, Matrix4, Uint16BufferAttribute, type ColorRepresentation } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/**
 * Collects the parts of one model and merges them into one geometry per material, so a character or a building
 * costs a handful of draw calls however many pieces it is made of. Every part carries vertex colours (one material
 * serves many colours) and, for characters, skin indices/weights.
 */

export type SkinFn = (vertex: number) => { bones: readonly number[]; weights: readonly number[] };

export interface PartOptions {
  material: string;
  color: ColorRepresentation;
  /** Optional per-vertex colour override (e.g. stubble on a jaw, darker boot soles). */
  colorAt?: (vertex: number, base: Color, out: Color) => void;
  /** Rigid attachment to one bone… */
  bone?: number;
  /** …or per-vertex weights (sweeps along limbs). */
  skin?: SkinFn;
  /** Applied to the geometry before it is added. */
  matrix?: Matrix4;
}

interface Part {
  geometry: BufferGeometry;
  material: string;
}

export class PartList {
  private readonly parts: Part[] = [];
  readonly skinned: boolean;

  constructor(opts: { skinned: boolean }) {
    this.skinned = opts.skinned;
  }

  add(source: BufferGeometry, o: PartOptions): void {
    const g = source.index ? source.toNonIndexed() : source.clone();
    if (o.matrix) {
      g.applyMatrix4(o.matrix);
      // A mirroring matrix turns triangles inside out: swap two corners of every triangle back.
      if (o.matrix.determinant() < 0) flipWinding(g);
    }
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    if (!g.getAttribute("uv")) g.setAttribute("uv", new Float32BufferAttribute(new Float32Array(g.getAttribute("position").count * 2), 2));
    // Extrude/Lathe groups would split the merge into material groups we do not use.
    g.clearGroups();
    const count = g.getAttribute("position").count;

    const base = new Color(o.color);
    const out = new Color();
    const colors = new Float32Array(count * 3);
    // toNonIndexed() reorders vertices, so a colour/skin function indexes the original geometry through this map.
    const original = source.index ? Array.from(source.index.array as ArrayLike<number>) : null;
    const src = (v: number) => (original ? (original[v] as number) : v);
    for (let v = 0; v < count; v++) {
      out.copy(base);
      o.colorAt?.(src(v), base, out);
      colors[v * 3] = out.r;
      colors[v * 3 + 1] = out.g;
      colors[v * 3 + 2] = out.b;
    }
    g.setAttribute("color", new Float32BufferAttribute(colors, 3));

    if (this.skinned) {
      const idx = new Uint16Array(count * 4);
      const wts = new Float32Array(count * 4);
      for (let v = 0; v < count; v++) {
        if (o.skin) {
          const s = o.skin(src(v));
          const total = s.weights.reduce((a, b) => a + b, 0) || 1;
          for (let k = 0; k < Math.min(4, s.bones.length); k++) {
            idx[v * 4 + k] = s.bones[k] as number;
            wts[v * 4 + k] = (s.weights[k] as number) / total;
          }
        } else {
          idx[v * 4] = o.bone ?? 0;
          wts[v * 4] = 1;
        }
      }
      g.setAttribute("skinIndex", new Uint16BufferAttribute(idx, 4));
      g.setAttribute("skinWeight", new Float32BufferAttribute(wts, 4));
    }
    this.parts.push({ geometry: g, material: o.material });
  }

  /** One merged geometry per material key. */
  build(): Map<string, BufferGeometry> {
    const byMaterial = new Map<string, BufferGeometry[]>();
    for (const p of this.parts) {
      const list = byMaterial.get(p.material) ?? [];
      list.push(p.geometry);
      byMaterial.set(p.material, list);
    }
    const out = new Map<string, BufferGeometry>();
    for (const [material, list] of byMaterial) {
      const merged = mergeGeometries(list, false);
      if (!merged) throw new Error(`could not merge parts for material ${material}`);
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      out.set(material, merged);
    }
    return out;
  }
}

function flipWinding(g: BufferGeometry): void {
  for (const name of Object.keys(g.attributes)) {
    const attr = g.getAttribute(name);
    const size = attr.itemSize;
    const a = attr.array as Float32Array;
    for (let t = 0; t + 2 < attr.count; t += 3) {
      for (let k = 0; k < size; k++) {
        const i1 = (t + 1) * size + k;
        const i2 = (t + 2) * size + k;
        const tmp = a[i1] as number;
        a[i1] = a[i2] as number;
        a[i2] = tmp;
      }
    }
    attr.needsUpdate = true;
  }
}

export function triangleCount(g: BufferGeometry): number {
  return (g.index ? g.index.count : g.getAttribute("position").count) / 3;
}
