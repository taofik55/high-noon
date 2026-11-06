"use client";

import {
  AnimationMixer,
  Box3,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { CardType } from "@/engine";
import { buildSaloon } from "../procedural/buildings/saloon";
import { buildBank, buildStore } from "../procedural/buildings/town";
import { buildClips } from "../procedural/character/clips";
import { buildCharacter } from "../procedural/character/cowboy";
import { buildHat } from "../procedural/character/hat";
import { ROSTER } from "../procedural/character/roster";
import { DEFAULT_SPEC, type CharacterSpec } from "../procedural/character/spec";
import { PartList } from "../procedural/core/parts";
import { isMaterialKey, material } from "../procedural/materials";
import { buildHorse } from "../procedural/props/horse";
import { buildBarrel, buildBottle, buildCell, buildDynamite, buildGatlingWagon, buildSpyglass, buildStagecoach } from "../procedural/props/props";
import { buildWeapon, type WeaponId } from "../procedural/weapons";

/**
 * Card illustrations (docs/07 §2.5): each card type is a small scene of the game's own procedural models, rendered
 * once in an offscreen WebGL canvas and finished in 2D as a sepia engraving (toned, hatched, vignetted), with a few
 * painted accents (muzzle flash, bullet streaks, a lit fuse). One look for the cards and the world, no image files.
 */

export const ART_W = 448;
export const ART_H = 240;

interface ArtScene {
  root: Object3D;
  /** Direction from the subject toward the camera. */
  view: [number, number, number];
  /** Frame this part of the scene instead of all of it (e.g. a character's upper body). */
  focus?: Box3;
  /** How much of the frame the subject fills (1 = edge to edge). */
  fill?: number;
  /** 2D accents drawn after the render, given a projector from world to canvas pixels. */
  accent?: (ctx: CanvasRenderingContext2D, project: (p: Vector3) => [number, number]) => void;
}

let clipCache: ReturnType<typeof buildClips> | null = null;

/** A character frozen at time `t` of a clip, optionally holding a weapon. */
function posed(spec: CharacterSpec, clip: string, t: number, gun?: WeaponId): { group: Object3D; hand: Object3D } {
  const ch = buildCharacter(spec);
  if (gun) ch.sockets.rightHand.add(buildWeapon(gun).group);
  else if (ch.hasHolster) ch.sockets.holster.add(buildWeapon("colt45").group);
  const mixer = new AnimationMixer(ch.group);
  clipCache ??= buildClips();
  const c = clipCache.find((x) => x.name === clip);
  if (c) {
    mixer.clipAction(c).play();
    mixer.update(t);
  }
  ch.group.updateMatrixWorld(true);
  return { group: ch.group, hand: ch.sockets.rightHand };
}

function hatOnly(): Object3D {
  const parts = new PartList({ skinned: false });
  buildHat(parts, DEFAULT_SPEC);
  const g = new Group();
  for (const [key, geo] of parts.build()) if (isMaterialKey(key)) g.add(new Mesh(geo, material(key)));
  return g;
}

const upperBody = (o: Object3D, top = 1.95, bottom = 0.85): Box3 => {
  const b = new Box3().setFromObject(o);
  b.min.y = Math.max(b.min.y, bottom);
  b.max.y = Math.min(b.max.y, top);
  return b;
};

function burst(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, points = 10): void {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 === 0 ? r : r * 0.42;
    const a = (i / (points * 2)) * Math.PI * 2;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function streaks(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, n: number): void {
  ctx.save();
  ctx.strokeStyle = "rgba(40,28,18,0.75)";
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    ctx.lineWidth = 3 - i * 0.5;
    ctx.beginPath();
    ctx.moveTo(x - len, y + (i - n / 2) * 9);
    ctx.lineTo(x, y + (i - n / 2) * 9 * 0.4);
    ctx.stroke();
  }
  ctx.restore();
}

function sceneFor(type: CardType): ArtScene {
  switch (type) {
    case "bang": {
      const { group, hand } = posed(ROSTER.black_jack, "Shoot", 0.05, "colt45");
      return {
        root: group,
        view: [0.75, 0.05, 1],
        focus: upperBody(group, 1.95, 1.1),
        fill: 0.9,
        accent: (ctx, project) => {
          const [x, y] = project(hand.localToWorld(new Vector3(0, 0.08, 0.3)));
          burst(ctx, x, y, 34, "rgba(255,190,60,0.95)", 12);
          burst(ctx, x, y, 16, "rgba(255,245,200,1)", 8);
        },
      };
    }
    case "missed": {
      const hat = hatOnly();
      hat.rotation.set(0.25, 0.6, -0.2);
      return {
        root: hat,
        view: [0.2, 0.3, 1],
        fill: 0.7,
        accent: (ctx) => {
          streaks(ctx, ART_W * 0.8, ART_H * 0.42, 150, 4);
          for (const [x, y] of [[ART_W * 0.47, ART_H * 0.3], [ART_W * 0.55, ART_H * 0.36]] as const) {
            ctx.fillStyle = "#1a120c";
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
          }
        },
      };
    }
    case "beer": {
      const g = new Group();
      const a = buildBottle().group;
      const b = buildBottle().group;
      b.position.set(0.11, 0, -0.04);
      b.rotation.z = -0.35;
      g.add(a, b);
      return { root: g, view: [0.3, 0.2, 1], fill: 0.75 };
    }
    case "saloon":
      return { root: buildSaloon().group, view: [0.45, 0.22, 1], fill: 0.95 };
    case "wells_fargo":
      return { root: buildBank().group, view: [0.45, 0.2, 1], fill: 0.95 };
    case "general_store":
      return { root: buildStore().group, view: [0.45, 0.2, 1], fill: 0.95 };
    case "panic": {
      const { group } = posed(ROSTER.jesse_jones, "Grab", 0.35);
      return { root: group, view: [0.9, 0.1, 0.7], focus: upperBody(group, 1.95, 0.9), fill: 0.92 };
    }
    case "cat_balou": {
      const { group } = posed(ROSTER.calamity_janet, "Throw", 0.45);
      return { root: group, view: [0.6, 0.1, 1], fill: 0.95 };
    }
    case "stagecoach":
      return { root: buildStagecoach().group, view: [1, 0.25, 0.8], fill: 0.95 };
    case "gatling":
      return { root: buildGatlingWagon().group, view: [0.8, 0.35, 1], fill: 0.9 };
    case "duel": {
      const g = new Group();
      const a = posed(ROSTER.willy_the_kid, "Aim", 0.9, "colt45").group;
      const b = posed(ROSTER.slab_the_killer, "Aim", 0.9, "colt45").group;
      a.position.set(-1.6, 0, 0);
      a.rotation.y = Math.PI / 2;
      b.position.set(1.6, 0, 0);
      b.rotation.y = -Math.PI / 2;
      g.add(a, b);
      return {
        root: g,
        view: [0, 0.12, 1],
        fill: 0.95,
        accent: (ctx) => {
          ctx.fillStyle = "rgba(255,230,170,0.6)";
          ctx.beginPath();
          ctx.arc(ART_W / 2, ART_H * 0.28, 26, 0, Math.PI * 2);
          ctx.fill();
        },
      };
    }
    case "indians": {
      const horse = buildHorse({ saddle: true, coat: "#8a5a32" });
      const rider = posed({ ...DEFAULT_SPEC, coat: "none", palette: { ...DEFAULT_SPEC.palette, shirt: "#a85a32", vest: "#4a3424" } }, "Ride", 0.5).group;
      rider.position.set(0, 0.55, -0.08);
      horse.group.add(rider);
      horse.legs.forEach((l, i) => (l.rotation.x = [0.55, 0.2, -0.5, -0.2][i] ?? 0));
      return {
        root: horse.group,
        view: [1, 0.15, 0.25],
        fill: 0.9,
        accent: (ctx) => {
          ctx.fillStyle = "rgba(120,90,60,0.35)";
          for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.arc(ART_W * 0.18 + i * 14, ART_H * 0.86 - (i % 2) * 6, 18 - i * 2, 0, Math.PI * 2);
            ctx.fill();
          }
        },
      };
    }
    case "barrel":
      return { root: buildBarrel().group, view: [0.4, 0.35, 1], fill: 0.7 };
    case "scope": {
      const s = buildSpyglass();
      s.rotation.z = -Math.PI / 2.4;
      return { root: s, view: [0.1, 0.3, 1], fill: 0.85 };
    }
    case "mustang":
      return { root: buildHorse({ saddle: true }).group, view: [1, 0.15, 0.45], fill: 0.95 };
    case "jail": {
      const g = new Group();
      g.add(buildCell());
      g.add(posed(ROSTER.sid_ketchum, "SitJail", 0.8).group);
      return { root: g, view: [0.35, 0.25, 1], fill: 0.95 };
    }
    case "dynamite": {
      const d = buildDynamite(true).group;
      d.rotation.z = -0.35;
      return {
        root: d,
        view: [0.3, 0.2, 1],
        fill: 0.8,
        accent: (ctx, project) => {
          const [x, y] = project(d.localToWorld(new Vector3(0.045, 0.255, 0.02)));
          burst(ctx, x, y, 16, "rgba(255,170,40,0.95)", 8);
          burst(ctx, x, y, 7, "rgba(255,250,220,1)", 6);
        },
      };
    }
    default: {
      // The weapons: shown in profile, muzzle to the right.
      const w = buildWeapon(type as WeaponId).group;
      w.rotation.y = Math.PI / 2;
      return { root: w, view: [0, 0.1, 1], fill: 0.88 };
    }
  }
}

let renderer: WebGLRenderer | null = null;
let failed = false;
const cache = new Map<CardType, HTMLCanvasElement | null>();

function offscreenRenderer(): WebGLRenderer | null {
  if (renderer || failed || typeof document === "undefined") return renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(ART_W, ART_H, false);
    renderer.setClearColor(0x000000, 0);
  } catch {
    failed = true;
    renderer = null;
  }
  return renderer;
}

let envScene: Scene | null = null;

function stage(): Scene {
  if (envScene) return envScene;
  const s = new Scene();
  s.add(new HemisphereLight("#fff1d6", "#6a4a30", 1.1));
  const key = new DirectionalLight("#ffe6c0", 2.6);
  key.position.set(4, 7, 6);
  s.add(key);
  const rim = new DirectionalLight("#c8d8ff", 0.8);
  rim.position.set(-5, 3, -4);
  s.add(rim);
  const r = offscreenRenderer();
  if (r) {
    const pmrem = new PMREMGenerator(r);
    s.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    s.environmentIntensity = 0.35;
    pmrem.dispose();
  }
  envScene = s;
  return s;
}

/** Parchment sky and ground behind the subject, before the sepia pass. */
function paintBackdrop(ctx: CanvasRenderingContext2D): void {
  const sky = ctx.createLinearGradient(0, 0, 0, ART_H);
  sky.addColorStop(0, "#f4e2bc");
  sky.addColorStop(0.62, "#e8cfa0");
  sky.addColorStop(0.63, "#d4b07a");
  sky.addColorStop(1, "#c49a62");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, ART_W, ART_H);
  // Distant mesas along the horizon.
  ctx.fillStyle = "rgba(150,100,70,0.35)";
  ctx.beginPath();
  ctx.moveTo(0, ART_H * 0.63);
  for (const [x, y] of [[0.05, 0.5], [0.18, 0.5], [0.22, 0.63], [0.62, 0.63], [0.66, 0.46], [0.84, 0.46], [0.9, 0.63], [1, 0.63]] as const) ctx.lineTo(x * ART_W, y * ART_H);
  ctx.lineTo(ART_W, ART_H * 0.63);
  ctx.fill();
}

/** Engraving finish: cross-hatching that darkens with the image, then a vignette. */
function engrave(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.strokeStyle = "rgba(90,60,30,0.10)";
  ctx.lineWidth = 1;
  for (let i = -ART_H; i < ART_W; i += 5) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + ART_H, ART_H);
    ctx.stroke();
  }
  const v = ctx.createRadialGradient(ART_W / 2, ART_H / 2, ART_H * 0.35, ART_W / 2, ART_H / 2, ART_W * 0.62);
  v.addColorStop(0, "rgba(255,255,255,1)");
  v.addColorStop(1, "rgba(120,80,40,1)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, ART_W, ART_H);
  ctx.restore();
}

/** The illustration for a card type (cached), or null where WebGL is unavailable (tests, old browsers). */
export function cardArt(type: CardType): HTMLCanvasElement | null {
  if (cache.has(type)) return cache.get(type) ?? null;
  const r = offscreenRenderer();
  if (!r) {
    cache.set(type, null);
    return null;
  }
  let out: HTMLCanvasElement | null = null;
  try {
    const art = sceneFor(type);
    const scene = stage();
    scene.add(art.root);
    art.root.updateMatrixWorld(true);
    const box = art.focus ?? new Box3().setFromObject(art.root);
    const size = box.getSize(new Vector3());
    const centre = box.getCenter(new Vector3());
    const camera = new PerspectiveCamera(30, ART_W / ART_H, 0.01, 500);
    const dir = new Vector3(...art.view).normalize();
    // Distance so the box fits both ways, then pulled in by the fill factor.
    const fitH = size.y / 2 / Math.tan((camera.fov * Math.PI) / 360);
    const fitW = Math.max(size.x, size.z) / 2 / Math.tan((camera.fov * Math.PI) / 360) / camera.aspect;
    const dist = (Math.max(fitH, fitW) / (art.fill ?? 0.9)) + Math.max(size.x, size.z) * 0.5;
    camera.position.copy(centre).addScaledVector(dir, dist);
    camera.lookAt(centre);
    camera.updateMatrixWorld();
    r.render(scene, camera);
    scene.remove(art.root);

    out = document.createElement("canvas");
    out.width = ART_W;
    out.height = ART_H;
    const ctx = out.getContext("2d");
    if (ctx) {
      paintBackdrop(ctx);
      ctx.filter = "sepia(0.75) contrast(1.12) saturate(0.85)";
      ctx.drawImage(r.domElement, 0, 0, ART_W, ART_H);
      ctx.filter = "none";
      const project = (p: Vector3): [number, number] => {
        const v = p.clone().project(camera);
        return [((v.x + 1) / 2) * ART_W, ((1 - v.y) / 2) * ART_H];
      };
      art.accent?.(ctx, project);
      engrave(ctx);
    }
  } catch (e) {
    console.error(`[card art] ${type}`, e);
    out = null;
  }
  cache.set(type, out);
  return out;
}

