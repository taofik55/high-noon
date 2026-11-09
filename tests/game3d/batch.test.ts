import { describe, expect, it } from "vitest";
import { Box3, BoxGeometry, Color, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Vector3, type Object3D } from "three";
import { bakeStatic } from "@/game3d/procedural/core/batch";
import { triangleCount } from "@/game3d/procedural/core/parts";
import { buildSaloon } from "@/game3d/procedural/buildings/saloon";
import { buildBank, buildSheriff } from "@/game3d/procedural/buildings/town";

const shared = (m: { name: string }) => m.name.startsWith("procedural.");

function triangles(root: Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (o instanceof InstancedMesh) n += triangleCount(o.geometry) * o.count;
    else if (o instanceof Mesh) n += triangleCount(o.geometry);
  });
  return n;
}

describe("static batching (docs/05 §9)", () => {
  it("keeps every triangle and the bounds of three buildings while cutting draw calls", () => {
    const root = new Group();
    [buildSaloon, buildSheriff, buildBank].forEach((b, i) => {
      const g = b().group;
      g.position.set(i * 14 - 14, 0, -10);
      // Quarter turns: Box3 of a rotated mesh is its rotated bounding box, which over-estimates any other angle.
      g.rotation.y = (i * Math.PI) / 2;
      root.add(g);
    });
    root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(root);
    const tris = triangles(root);
    const { group, before, after } = bakeStatic(root, shared);
    expect(triangles(group)).toBe(tris);
    expect(after).toBeLessThan(before / 2);
    group.updateMatrixWorld(true);
    const baked = new Box3().setFromObject(group);
    expect(baked.min.distanceTo(box.min)).toBeLessThan(1e-3);
    expect(baked.max.distanceTo(box.max)).toBeLessThan(1e-3);
  });

  it("bakes instance transforms and colours, and flips mirrored faces outward", () => {
    const mat = new MeshStandardMaterial({ vertexColors: true });
    mat.name = "procedural.test";
    const inst = new InstancedMesh(new BoxGeometry(1, 1, 1), mat, 2);
    inst.setMatrixAt(0, new Matrix4().makeTranslation(5, 0, 0));
    inst.setMatrixAt(1, new Matrix4().makeScale(-1, 1, 1));
    inst.setColorAt(0, new Color(1, 0, 0));
    inst.setColorAt(1, new Color(0, 0, 1));
    const root = new Group();
    root.add(inst);
    const { group } = bakeStatic(root, shared);
    const mesh = group.children[0] as Mesh;
    const pos = mesh.geometry.getAttribute("position");
    const col = mesh.geometry.getAttribute("color");
    expect(pos.count).toBe(48);
    expect(pos.getX(0)).toBeGreaterThan(4);
    expect([col.getX(0), col.getZ(0)]).toEqual([1, 0]);
    expect([col.getX(24), col.getZ(24)]).toEqual([0, 1]);
    // The mirrored box's first face (+x side, now at -x) must still face away from the centre.
    const idx = mesh.geometry.getIndex()!;
    const [a, b, c] = [idx.getX(36), idx.getX(37), idx.getX(38)].map((i) => new Vector3().fromBufferAttribute(pos, i));
    const normal = new Vector3().subVectors(b!, a!).cross(new Vector3().subVectors(c!, a!));
    const centre = new Vector3().add(a!).add(b!).add(c!).divideScalar(3);
    expect(normal.dot(centre)).toBeGreaterThan(0);
  });

  it("keeps meshes with their own material unbatched", () => {
    const own = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    own.position.set(1, 2, 3);
    const root = new Group();
    root.position.set(10, 0, 0);
    root.add(own);
    const { group } = bakeStatic(root, shared);
    expect(group.children).toHaveLength(1);
    expect((group.children[0] as Mesh).position.toArray()).toEqual([1, 2, 3]);
  });
});

describe("town detail levels", () => {
  it("a half-detail saloon keeps its parts with fewer triangles", async () => {
    const { withDetail } = await import("@/game3d/procedural/core/detail");
    const full = buildSaloon();
    const low = withDetail(0.5, () => buildSaloon());
    console.log(`[budget] saloon full ${full.triangles} / half ${low.triangles}`);
    expect(low.triangles).toBeLessThan(full.triangles * 0.8);
    expect(low.drawCalls).toBe(full.drawCalls);
  });
});
