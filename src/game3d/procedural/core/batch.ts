import { BufferAttribute, BufferGeometry, Color, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, type Material, type Object3D } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/**
 * Static batching (docs/05 §9 "merged static town geometry"): bakes every mesh under `root` that uses a shared
 * material into one mesh per material, instances included, so the whole town costs a handful of draw calls instead of
 * one or more per building part. Meshes with their own material (signs with canvas text) are kept as they are.
 * Only for things that never move again.
 */
export interface BatchResult {
  group: Group;
  /** Draw calls before and after (one per mesh; shadow passes double both). */
  before: number;
  after: number;
}

const ATTRS = ["position", "normal", "uv", "color"] as const;

/** Same attribute set everywhere (mergeGeometries requires it); missing colour = white, missing uv = 0. */
function normalise(g: BufferGeometry, tint: Color | null): BufferGeometry {
  const out = new BufferGeometry();
  const count = g.getAttribute("position").count;
  for (const name of ATTRS) {
    const src = g.getAttribute(name) as BufferAttribute | undefined;
    if (src) out.setAttribute(name, new Float32BufferAttribute(Float32Array.from(src.array as ArrayLike<number>), src.itemSize));
    else if (name === "color") out.setAttribute(name, new Float32BufferAttribute(new Float32Array(count * 3).fill(1), 3));
    else if (name === "uv") out.setAttribute(name, new Float32BufferAttribute(new Float32Array(count * 2), 2));
  }
  if (!out.getAttribute("normal")) out.computeVertexNormals();
  if (tint) {
    // Instance colours multiply the vertex colours in the shader; bake that product.
    const c = out.getAttribute("color");
    for (let v = 0; v < count; v++) c.setXYZ(v, c.getX(v) * tint.r, c.getY(v) * tint.g, c.getZ(v) * tint.b);
  }
  const index = g.getIndex();
  out.setIndex(index ? Array.from(index.array as ArrayLike<number>) : Array.from({ length: count }, (_, i) => i));
  return out;
}

/** Moves a normalised copy into batch space; mirrored transforms flip the winding so faces stay outward. */
function placed(g: BufferGeometry, m: Matrix4, tint: Color | null): BufferGeometry {
  const out = normalise(g, tint);
  out.applyMatrix4(m);
  if (m.determinant() < 0) {
    const idx = out.getIndex() as BufferAttribute;
    const a = idx.array as Uint16Array | Uint32Array;
    for (let t = 0; t + 2 < a.length; t += 3) {
      const tmp = a[t + 1] as number;
      a[t + 1] = a[t + 2] as number;
      a[t + 2] = tmp;
    }
  }
  return out;
}

export function bakeStatic(root: Object3D, isShared: (m: Material) => boolean): BatchResult {
  root.updateMatrixWorld(true);
  const toRoot = new Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<Material, BufferGeometry[]>();
  const kept: Mesh[] = [];
  let before = 0;
  const m = new Matrix4();
  const im = new Matrix4();
  const tint = new Color();

  root.traverse((o) => {
    if (!(o instanceof Mesh) || !o.visible) return;
    const material = o.material as Material | Material[];
    before++;
    if (Array.isArray(material) || !isShared(material)) {
      kept.push(o);
      return;
    }
    const list = buckets.get(material) ?? [];
    m.multiplyMatrices(toRoot, o.matrixWorld);
    if (o instanceof InstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, im);
        let t: Color | null = null;
        if (o.instanceColor) {
          o.getColorAt(i, tint);
          t = tint;
        }
        list.push(placed(o.geometry, im.premultiply(m), t));
      }
    } else list.push(placed(o.geometry, m, null));
    buckets.set(material, list);
  });

  const group = new Group();
  group.name = "static-batch";
  for (const [material, list] of buckets) {
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (!merged) continue;
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    const mesh = new Mesh(merged, material);
    mesh.name = `batch.${material.name}`;
    mesh.castShadow = !material.transparent;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }
  // Unshared meshes move over as they are, with their transform baked into the batch space.
  for (const o of kept) {
    const copy = o.clone(false);
    m.multiplyMatrices(toRoot, o.matrixWorld);
    m.decompose(copy.position, copy.quaternion, copy.scale);
    copy.updateMatrix();
    copy.matrixAutoUpdate = false;
    group.add(copy);
  }
  group.matrixAutoUpdate = false;
  return { group, before, after: group.children.length };
}
