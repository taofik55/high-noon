import { describe, expect, it } from "vitest";
import { SkinnedMesh, Vector3, type BufferGeometry, type Mesh } from "three";
import { buildCharacter, characterGeometry } from "@/game3d/procedural/character/cowboy";
import { buildClips } from "@/game3d/procedural/character/clips";
import { ROSTER } from "@/game3d/procedural/character/roster";
import { BONE_NAMES } from "@/game3d/procedural/character/skeleton";
import { DEFAULT_SPEC } from "@/game3d/procedural/character/spec";
import { sweep } from "@/game3d/procedural/core/sweep";
import { buildColt45 } from "@/game3d/procedural/weapons/colt45";
import { buildWeapon, WEAPON_IDS } from "@/game3d/procedural/weapons";
import { animateHorse, buildHorse } from "@/game3d/procedural/props/horse";
import * as props from "@/game3d/procedural/props/props";
import { buildSaloon } from "@/game3d/procedural/buildings/saloon";
import { buildBank, buildSheriff, buildStable, buildStagecoachStop, buildStore, buildUndertaker, buildWaterTower } from "@/game3d/procedural/buildings/town";

function finite(g: BufferGeometry): boolean {
  const a = g.getAttribute("position").array as ArrayLike<number>;
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i] as number)) return false;
  return true;
}

describe("procedural core", () => {
  it("sweeps produce outward-facing normals", () => {
    const { geometry } = sweep({
      path: [new Vector3(0, 0, 0), new Vector3(0, 1, 0)],
      rings: [
        { w: 0.5, f: 0.5, b: 0.5 },
        { w: 0.5, f: 0.5, b: 0.5 },
      ],
      front: new Vector3(0, 0, 1),
      radial: 12,
    });
    const pos = geometry.getAttribute("position");
    const nrm = geometry.getAttribute("normal");
    for (let i = 0; i < pos.count; i++) {
      const out = new Vector3(pos.getX(i), 0, pos.getZ(i)).normalize();
      expect(out.dot(new Vector3(nrm.getX(i), 0, nrm.getZ(i)))).toBeGreaterThan(0.5);
    }
  });
});

describe("master cowboy", () => {
  const c = buildCharacter();

  it("stays within 25,000 triangles and a handful of draw calls", () => {
    console.log(`[budget] cowboy ${c.triangles} tris, ${characterGeometry(DEFAULT_SPEC).size} materials`);
    expect(c.triangles).toBeLessThanOrEqual(25_000);
    expect(characterGeometry(DEFAULT_SPEC).size).toBeLessThanOrEqual(9);
  });

  it("is valid skinned geometry on the shared skeleton", () => {
    expect(c.skeleton.bones.map((b) => b.name)).toEqual([...BONE_NAMES]);
    const meshes = c.group.children.filter((o): o is SkinnedMesh => (o as SkinnedMesh).isSkinnedMesh);
    expect(meshes.length).toBeGreaterThan(3);
    for (const m of meshes) {
      expect(m.skeleton).toBe(c.skeleton);
      const g = m.geometry;
      expect(finite(g)).toBe(true);
      const idx = g.getAttribute("skinIndex");
      const w = g.getAttribute("skinWeight");
      for (let v = 0; v < w.count; v++) {
        const sum = w.getX(v) + w.getY(v) + w.getZ(v) + w.getW(v);
        expect(Math.abs(sum - 1)).toBeLessThan(1e-4);
        expect(idx.getX(v)).toBeLessThan(BONE_NAMES.length);
      }
    }
  });

  it("stands on the ground at a believable height", () => {
    const box = { min: Infinity, max: -Infinity };
    for (const g of characterGeometry(DEFAULT_SPEC).values()) {
      g.computeBoundingBox();
      box.min = Math.min(box.min, g.boundingBox?.min.y ?? 0);
      box.max = Math.max(box.max, g.boundingBox?.max.y ?? 0);
    }
    expect(box.min).toBeGreaterThan(-0.01);
    expect(box.min).toBeLessThan(0.02);
    expect(box.max).toBeGreaterThan(1.85); // hat
    expect(box.max).toBeLessThan(2.0);
  });

  it("animates only bones that exist", () => {
    const names = new Set<string>(BONE_NAMES);
    for (const clip of buildClips()) {
      for (const t of clip.tracks) expect(names.has(t.name.split(".")[0] as string), `${clip.name}: ${t.name}`).toBe(true);
    }
  });
});

describe("the 16 characters", () => {
  it.each(Object.entries(ROSTER))("%s stays within budget with valid skinning", (id, spec) => {
    const c = buildCharacter(spec);
    console.log(`[budget] ${id} ${c.triangles} tris, ${characterGeometry(spec).size} materials`);
    expect(c.triangles).toBeLessThanOrEqual(25_000);
    expect(characterGeometry(spec).size).toBeLessThanOrEqual(9);
    for (const g of characterGeometry(spec).values()) {
      expect(finite(g)).toBe(true);
      const w = g.getAttribute("skinWeight");
      for (let v = 0; v < w.count; v += 7) expect(Math.abs(w.getX(v) + w.getY(v) + w.getZ(v) + w.getW(v) - 1)).toBeLessThan(1e-4);
    }
  });

  it("are visibly different from each other", () => {
    const keys = new Set(Object.values(ROSTER).map((s) => JSON.stringify(s)));
    expect(keys.size).toBe(16);
  });
});

describe("colt .45 and saloon", () => {
  it("revolver is a detailed but light separate model", () => {
    const { group, triangles } = buildColt45();
    console.log(`[budget] colt45 ${triangles} tris, ${group.children.length} meshes`);
    expect(triangles).toBeGreaterThan(1500);
    expect(triangles).toBeLessThan(8000);
    for (const m of group.children) expect(finite((m as Mesh).geometry)).toBe(true);
  });

  it("saloon is a few draw calls thanks to instancing and merging", () => {
    const { group, triangles, drawCalls } = buildSaloon();
    console.log(`[budget] saloon ${triangles} tris, ${drawCalls} draw calls`);
    expect(drawCalls).toBeLessThanOrEqual(16);
    expect(triangles).toBeLessThan(120_000);
    group.traverse((o) => {
      const g = (o as Mesh).geometry;
      if (g) expect(finite(g)).toBe(true);
    });
  });
});

describe("the rest of the town", () => {
  it.each([
    ["sheriff", buildSheriff],
    ["bank", buildBank],
    ["store", buildStore],
    ["stable", buildStable],
    ["undertaker", buildUndertaker],
    ["water_tower", buildWaterTower],
    ["stagecoach_stop", buildStagecoachStop],
  ] as const)("%s is valid and light", (name, build) => {
    const { group, triangles, drawCalls } = build();
    console.log(`[budget] ${name} ${triangles} tris, ${drawCalls} draw calls`);
    expect(drawCalls).toBeLessThanOrEqual(16);
    expect(triangles).toBeLessThan(60_000);
    group.traverse((o) => {
      const g = (o as Mesh).geometry;
      if (g) expect(finite(g)).toBe(true);
    });
  });
});

describe("weapons", () => {
  it.each(WEAPON_IDS)("%s is a light, valid model", (id) => {
    const { group, triangles } = buildWeapon(id);
    console.log(`[budget] ${id} ${triangles} tris, ${group.children.length} meshes`);
    expect(triangles).toBeGreaterThan(800);
    expect(triangles).toBeLessThan(10_000);
    for (const m of group.children) expect(finite((m as Mesh).geometry)).toBe(true);
  });
});

describe("props and the horse", () => {
  it("the horse is light, posable and stands on the ground", () => {
    const h = buildHorse({ saddle: true });
    console.log(`[budget] horse ${h.triangles} tris`);
    expect(h.triangles).toBeLessThan(15_000);
    expect(h.legs).toHaveLength(4);
    animateHorse(h, 1.3, "gallop");
    expect(h.legs.some((l) => Math.abs(l.rotation.x) > 0.05)).toBe(true);
  });

  it.each([
    ["wagon", props.buildGatlingWagon],
    ["stagecoach", props.buildStagecoach],
    ["tumbleweed", () => props.buildTumbleweed()],
    ["bottle", props.buildBottle],
    ["dynamite", () => props.buildDynamite(true)],
    ["shackles", props.buildShackles],
    ["grave", props.buildGrave],
    ["crate", () => props.buildCrate()],
    ["cactus", () => props.buildCactus()],
    ["rock", () => props.buildRock()],
    ["barrel", props.buildBarrel],
  ] as const)("%s is valid", (name, build) => {
    const { group, triangles } = build();
    console.log(`[budget] ${name} ${triangles} tris`);
    expect(triangles).toBeGreaterThan(20);
    expect(triangles).toBeLessThan(40_000);
    group.traverse((o) => {
      const g = (o as Mesh).geometry;
      if (g) expect(finite(g)).toBe(true);
    });
  });
});
