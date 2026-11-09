"use client";

import { useEffect, useMemo, useState } from "react";
import { Sky } from "@react-three/drei";
import { CanvasTexture, Group, SRGBColorSpace, Vector3 } from "three";
import { buildSaloon } from "../procedural/buildings/saloon";
import { buildBank, buildSheriff, buildStable, buildStagecoachStop, buildStore, buildUndertaker, buildWaterTower } from "../procedural/buildings/town";
import type { BuiltBuilding } from "../procedural/buildings/kit";
import { buildCactus, buildRock } from "../procedural/props/props";
import { bakeStatic } from "../procedural/core/batch";
import { withDetail } from "../procedural/core/detail";
import { enqueue, PRIORITY } from "../streaming/buildQueue";
import { placeholdersOnly } from "../assetMode";
import { BUILDINGS, MESAS, type Building } from "./layout";

const SUN: [number, number, number] = [30, 42, 18];

function signTexture(text: string): CanvasTexture | null {
  if (!text) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#3a2717";
  ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = "#d9a441";
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 504, 88);
  ctx.fillStyle = "#f3d58c";
  ctx.font = "bold 52px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 50, 480);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function BuildingBox({ b }: { b: Building }) {
  const [w, h, d] = b.size;
  const sign = useMemo(() => signTexture(b.label), [b.label]);
  return (
    <group position={b.position} rotation={[0, b.rotationY, 0]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={b.color} roughness={0.95} />
      </mesh>
      {/* Overhanging roof */}
      <mesh position={[0, h + 0.15, 0]} castShadow>
        <boxGeometry args={[w + 0.6, 0.3, d + 0.6]} />
        <meshStandardMaterial color="#4a3324" roughness={1} />
      </mesh>
      {/* Porch roof on the square side (+z after rotation) */}
      <mesh position={[0, h * 0.55, d / 2 + 0.9]} castShadow>
        <boxGeometry args={[w, 0.12, 1.8]} />
        <meshStandardMaterial color="#5c4030" roughness={1} />
      </mesh>
      {sign && (
        <mesh position={[0, h * 0.8, d / 2 + 0.02]}>
          <planeGeometry args={[Math.min(w * 0.85, 6), Math.min(w * 0.85, 6) * (96 / 512)]} />
          <meshStandardMaterial map={sign} roughness={0.8} />
        </mesh>
      )}
    </group>
  );
}

/** Procedural buildings by layout id, with the depth of their footprint (front wall at +depth/2). */
const PROCEDURAL: Record<string, { build: () => BuiltBuilding; depth: number }> = {
  "building.saloon": { build: buildSaloon, depth: 9 },
  "building.sheriff": { build: buildSheriff, depth: 6 },
  "building.bank": { build: buildBank, depth: 8 },
  "building.store": { build: buildStore, depth: 8 },
  "building.stable": { build: buildStable, depth: 9 },
  "building.undertaker": { build: buildUndertaker, depth: 6 },
  "building.water_tower": { build: buildWaterTower, depth: 0 },
  "building.stagecoach_stop": { build: buildStagecoachStop, depth: 4 },
};

function proceduralBuilding(id: string): Group | null {
  try {
    return PROCEDURAL[id]?.build().group ?? null;
  } catch (e) {
    console.error(`[town] ${id} falls back to its placeholder`, e);
    return null;
  }
}

/** Places a layout building's model with its front wall where the layout box's front face was (porches reach toward the square). */
function placeBuilding(group: Group, b: Building): void {
  const depth = PROCEDURAL[b.id]?.depth ?? 0;
  const back = (b.size[2] - depth) / 2;
  const offset = new Vector3(0, 0, back).applyAxisAngle(new Vector3(0, 1, 0), b.rotationY);
  group.position.set(b.position[0] + offset.x, 0, b.position[2] + offset.z);
  group.rotation.set(0, b.rotationY, 0);
}

/**
 * The procedural town as one static batch (docs/05 §9): every building, cactus and rock merged per shared material.
 * Built once per page and detail level (the low preset uses coarser curves). Buildings that fail to build are listed
 * in `missing` and drawn as placeholder boxes.
 */
interface TownBatch {
  group: Group;
  missing: Set<string>;
  before: number;
  after: number;
}
const townBatches = new Map<number, TownBatch>();
function proceduralTown(detail: number): TownBatch | null {
  if (placeholdersOnly()) return null;
  const hit = townBatches.get(detail);
  if (hit) return hit;
  const batch = withDetail(detail, buildTown);
  townBatches.set(detail, batch);
  return batch;
}

function buildTown(): TownBatch {
  const root = new Group();
  const missing = new Set<string>();
  for (const b of BUILDINGS) {
    const g = proceduralBuilding(b.id);
    if (!g) {
      missing.add(b.id);
      continue;
    }
    placeBuilding(g, b);
    root.add(g);
  }
  for (const c of CACTI) {
    const g = buildCactus(Math.round(c.position[0] * 7 + c.position[2] * 3)).group;
    g.position.set(...c.position);
    g.scale.setScalar(c.scale * 1.1);
    root.add(g);
  }
  for (const r of ROCKS) {
    const g = buildRock(r.seed, 0.8).group;
    g.position.set(...r.position);
    g.scale.setScalar(r.scale);
    root.add(g);
  }
  try {
    return { ...bakeStatic(root, (m) => m.name.startsWith("procedural.")), missing };
  } catch (e) {
    // Batching is an optimisation: if it fails, draw the unbatched town.
    console.error("[town] static batching failed", e);
    return { group: root, missing, before: 0, after: 0 };
  }
}

const ROCKS: { position: [number, number, number]; scale: number; seed: number }[] = [
  { position: [-24, 0, 10], scale: 1.4, seed: 11 },
  { position: [25, 0, 14], scale: 1.0, seed: 12 },
  { position: [-30, 0, -10], scale: 1.8, seed: 13 },
  { position: [30, 0, -4], scale: 1.2, seed: 14 },
  { position: [14, 0, 27], scale: 0.9, seed: 15 },
  { position: [-14, 0, 28], scale: 1.1, seed: 16 },
];

const CACTI: { position: [number, number, number]; scale: number }[] = [
  { position: [-26, 0, 18], scale: 1.1 },
  { position: [28, 0, 22], scale: 0.9 },
  { position: [-32, 0, -24], scale: 1.3 },
  { position: [34, 0, -20], scale: 1 },
  { position: [22, 0, 30], scale: 0.8 },
  { position: [-20, 0, 32], scale: 1.2 },
];

/** The placeholder town square at high noon / golden hour (docs/05 §1–2, §7). */
export function Town({ shadows, shadowMapSize, detail = 1 }: { shadows: boolean; shadowMapSize: number; detail?: number }) {
  // Placeholder boxes until the build queue has made the procedural town (instant when it is already built).
  const [town, setTown] = useState<TownBatch | null>(() => townBatches.get(detail) ?? null);
  useEffect(() => {
    if (placeholdersOnly()) return;
    let alive = true;
    void enqueue(`town:${detail}`, "town", PRIORITY.essential, () => proceduralTown(detail)).then((t) => {
      if (alive) setTown(t);
    });
    return () => {
      alive = false;
    };
  }, [detail]);
  return (
    <>
      <Sky sunPosition={SUN} turbidity={6} rayleigh={1.2} mieCoefficient={0.006} mieDirectionalG={0.85} />
      <fog attach="fog" args={["#e8c99a", 40, 180]} />
      <hemisphereLight args={["#ffe9c4", "#7a5a3a", 0.75]} />
      <directionalLight
        position={SUN}
        intensity={2.2}
        color="#ffe2b0"
        castShadow={shadows}
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-camera-far={120}
        shadow-bias={-0.0004}
      />

      {/* Desert floor and the packed-earth square */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#d2a86e" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[11, 48]} />
        <meshStandardMaterial color="#b98c58" roughness={1} />
      </mesh>

      {town && <primitive object={town.group} />}
      {BUILDINGS.filter((b) => !town || town.missing.has(b.id)).map((b) => (
        <BuildingBox key={b.id} b={b} />
      ))}
      {MESAS.map((m, i) => (
        <mesh key={i} position={[m.position[0], m.height / 2, m.position[2]]}>
          <cylinderGeometry args={[m.radius * 0.8, m.radius, m.height, 7]} />
          <meshStandardMaterial color="#b06a45" roughness={1} />
        </mesh>
      ))}
    </>
  );
}
