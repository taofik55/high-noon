"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { AnimationMixer, Box3, Group, Mesh, Vector3, type AnimationAction, type Material, type MeshStandardMaterial, type Object3D } from "three";
import { buildCharacter, type BuiltCharacter } from "../character/cowboy";
import { buildClips } from "../character/clips";
import { ROSTER } from "../character/roster";
import { DEFAULT_SPEC } from "../character/spec";
import type { CharacterId } from "@/engine";
import { BONE_NAMES } from "../character/skeleton";
import { buildColt45 } from "../weapons/colt45";
import { buildWeapon, WEAPON_IDS } from "../weapons";
import { buildSaloon } from "../buildings/saloon";
import { buildBank, buildSheriff, buildStable, buildStagecoachStop, buildStore, buildUndertaker, buildWaterTower } from "../buildings/town";
import { StudioEnvironment } from "../StudioEnvironment";

import type { AssetId } from "./assetList";

export type { AssetId };

export interface AssetStats {
  triangles: number;
  drawCalls: number;
  meshes: number;
  instanced: number;
  materials: string[];
  textures: string[];
  bones: number;
}

export type CameraPreset = "threeQuarter" | "front" | "side" | "back" | "close";
export const CAMERA_PRESETS: { id: CameraPreset; label: string }[] = [
  { id: "threeQuarter", label: "3/4" },
  { id: "front", label: "Depan" },
  { id: "side", label: "Samping" },
  { id: "back", label: "Belakang" },
  { id: "close", label: "Close-up" },
];

interface ViewerProps {
  asset: AssetId;
  /** Which character to show for the "cowboy" asset: the master or one of the 16. */
  character: CharacterId | "master";
  view: CameraPreset;
  clip: string;
  playing: boolean;
  gunInHand: boolean;
  wireframe: boolean;
  autoRotate: boolean;
  onStats: (s: AssetStats) => void;
  onClips: (names: string[]) => void;
}

/** Built asset plus everything the viewer needs to pose and measure it. */
interface Loaded {
  object: Object3D;
  character: BuiltCharacter | null;
  gun: Object3D | null;
  triangles: number;
}

function load(asset: AssetId, who: CharacterId | "master"): Loaded {
  if (asset === "cowboy") {
    const character = buildCharacter(who === "master" ? DEFAULT_SPEC : ROSTER[who]);
    const gun = buildColt45().group;
    if (character.sockets.holsterLeft) character.sockets.holsterLeft.add(buildColt45().group);
    return { object: character.group, character, gun, triangles: character.triangles };
  }
  if (asset === "lineup") {
    // All 16 in two rows, alphabetical like the roster, each on its own skeleton.
    const group = new Group();
    let triangles = 0;
    Object.values(ROSTER).forEach((spec, i) => {
      const c = buildCharacter(spec);
      c.group.position.set((i % 8) * 0.9 - 3.15, 0, i < 8 ? 0 : -1.4);
      group.add(c.group);
      triangles += c.triangles;
    });
    return { object: group, character: null, gun: null, triangles };
  }
  if (asset === "weapons") {
    // The six weapon cards, one above the other, shown at 3× scale.
    const group = new Group();
    let triangles = 0;
    WEAPON_IDS.forEach((id, i) => {
      const w = buildWeapon(id);
      w.group.position.set(0, 0.4 + (WEAPON_IDS.length - 1 - i) * 0.32, 0);
      w.group.rotation.y = -Math.PI / 2;
      group.add(w.group);
      triangles += w.triangles;
    });
    group.scale.setScalar(3);
    return { object: group, character: null, gun: null, triangles };
  }
  if (asset === "colt45") {
    const { group, triangles } = buildColt45();
    group.scale.setScalar(4);
    return { object: group, character: null, gun: null, triangles };
  }
  const builders = {
    saloon: buildSaloon,
    sheriff: buildSheriff,
    bank: buildBank,
    store: buildStore,
    stable: buildStable,
    undertaker: buildUndertaker,
    water_tower: buildWaterTower,
    stagecoach_stop: buildStagecoachStop,
  } as const;
  const { group, triangles } = builders[asset]();
  return { object: group, character: null, gun: null, triangles };
}

function collectStats(root: Object3D, triangles: number, gunTris: number): Omit<AssetStats, "drawCalls"> {
  const materials = new Set<string>();
  const textures = new Set<string>();
  let meshes = 0;
  let instanced = 0;
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    meshes++;
    if ((o as { isInstancedMesh?: boolean }).isInstancedMesh) instanced++;
    for (const m of ([] as Material[]).concat(mesh.material)) {
      materials.add(m.name || m.type);
      const map = (m as MeshStandardMaterial).map;
      const img = map?.image as { width?: number; height?: number } | undefined;
      if (map && img?.width) textures.add(`${m.name || m.type}: ${img.width}×${img.height}`);
    }
  });
  return { triangles: triangles + gunTris, meshes, instanced, materials: [...materials], textures: [...textures], bones: 0 };
}

function Scene({ asset, character, view, clip, playing, gunInHand, wireframe, autoRotate, onStats, onClips }: ViewerProps) {
  const loaded = useMemo(() => load(asset, character), [asset, character]);
  const clips = useMemo(() => (loaded.character ? buildClips() : []), [loaded]);
  const mixer = useMemo(() => (loaded.character ? new AnimationMixer(loaded.character.group) : null), [loaded]);
  const action = useRef<AnimationAction | null>(null);
  const gl = useThree((s) => s.gl);
  // Read the camera inside effects (it is three.js state, not React state).
  const getState = useThree((s) => s.get);
  const controls = useRef<{ target: Vector3; update: () => void } | null>(null);
  const gunTris = useMemo(() => (loaded.gun ? buildColt45().triangles : 0), [loaded]);

  useEffect(() => onClips(clips.map((c) => c.name)), [clips, onClips]);

  // Frame the asset from a preset direction; "close" looks at the head (character) or the detail-rich front.
  useEffect(() => {
    const camera = getState().camera;
    const box = new Box3().setFromObject(loaded.object);
    const size = box.getSize(new Vector3());
    let centre = box.getCenter(new Vector3());
    let dist = Math.max(size.x, size.y, size.z) * 1.7 + 0.3;
    if (view === "close") {
      if (loaded.character) centre = new Vector3(0, 1.68, 0);
      else if (asset !== "colt45" && asset !== "lineup" && asset !== "weapons") centre = new Vector3(0, size.y * 0.45, box.max.z - 1);
      dist = loaded.character ? 0.75 : asset === "colt45" || asset === "weapons" ? dist * 0.6 : Math.max(size.x, size.y) * 0.9;
    }
    const dir = {
      threeQuarter: new Vector3(0.55, 0.25, 0.85),
      front: new Vector3(0, 0.12, 1),
      side: new Vector3(1, 0.12, 0),
      back: new Vector3(-0.3, 0.2, -1),
      close: new Vector3(0.35, 0.08, 1),
    }[view].normalize();
    camera.position.copy(centre).addScaledVector(dir, dist);
    camera.near = dist / 200;
    camera.far = dist * 40;
    camera.updateProjectionMatrix();
    if (controls.current) {
      controls.current.target.copy(centre);
      controls.current.update();
    }
  }, [loaded, getState, view, asset]);

  // Revolver in the hand or the holster.
  useEffect(() => {
    const c = loaded.character;
    const gun = loaded.gun;
    if (!c || !gun) return;
    if (gunInHand) c.sockets.rightHand.add(gun);
    else if (c.hasHolster) c.sockets.holster.add(gun);
    else gun.removeFromParent();
  }, [loaded, gunInHand]);

  useEffect(() => {
    if (!mixer) return;
    const next = clips.find((c) => c.name === clip) ?? clips[0];
    if (!next) return;
    const a = mixer.clipAction(next);
    a.reset().fadeIn(0.25).play();
    if (action.current && action.current !== a) action.current.fadeOut(0.25);
    action.current = a;
    a.clampWhenFinished = true;
    a.setLoop(next.name === "Death_A" || next.name === "Draw" ? 2200 : 2201, Infinity); // LoopOnce : LoopRepeat
  }, [mixer, clips, clip]);

  useEffect(() => {
    if (action.current) action.current.paused = !playing;
  }, [playing]);

  // Wireframe on every material in the asset (shared materials are restored when the viewer unmounts).
  useEffect(() => {
    const mats = new Set<MeshStandardMaterial>();
    loaded.object.traverse((o) => {
      const m = (o as Mesh).material as MeshStandardMaterial | MeshStandardMaterial[] | undefined;
      if (m) for (const x of ([] as MeshStandardMaterial[]).concat(m)) mats.add(x);
    });
    loaded.gun?.traverse((o) => {
      const m = (o as Mesh).material as MeshStandardMaterial | undefined;
      if (m) mats.add(m);
    });
    mats.forEach((m) => (m.wireframe = wireframe));
    return () => mats.forEach((m) => (m.wireframe = false));
  }, [loaded, wireframe]);

  useEffect(() => {
    const base = collectStats(loaded.object, loaded.triangles, gunTris);
    const bones = loaded.character ? BONE_NAMES.length : 0;
    const id = window.setInterval(() => {
      const stats: AssetStats = { ...base, bones, drawCalls: gl.info.render.calls };
      onStats(stats);
      (window as unknown as { __assetStats?: AssetStats }).__assetStats = stats;
    }, 500);
    return () => window.clearInterval(id);
  }, [loaded, gunTris, gl, onStats]);

  useFrame((_, dt) => mixer?.update(dt));

  return (
    <>
      <color attach="background" args={["#2a2420"]} />
      <StudioEnvironment />
      <hemisphereLight args={["#f3dcb2", "#4a3a2a", 0.9]} />
      <directionalLight
        position={[6, 9, 7]}
        intensity={2.4}
        color="#ffe2b0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-6, 4, -5]} intensity={0.6} color="#9fb6d4" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.001, 0]}>
        <circleGeometry args={[40, 64]} />
        <meshStandardMaterial color="#b89a72" roughness={1} />
      </mesh>
      <primitive object={loaded.object} />
      <OrbitControls ref={controls as never} makeDefault autoRotate={autoRotate} autoRotateSpeed={0.8} enableDamping />
    </>
  );
}

export function AssetViewer(props: ViewerProps) {
  return (
    <Canvas shadows="percentage" camera={{ fov: 35, position: [3, 2, 4] }} gl={{ antialias: true }} data-testid="asset-canvas">
      <Scene {...props} />
    </Canvas>
  );
}
