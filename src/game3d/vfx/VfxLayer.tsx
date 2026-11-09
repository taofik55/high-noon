"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import gsap from "gsap";
import {
  AnimationMixer,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
  type Material,
  type Object3D,
} from "three";
import type { CardId } from "@/engine";
import { audio } from "../audio/engine";
import { CARD_GEOMETRY, cardMaterials, disposeCardMaterials } from "../cards/CardMesh";
import { registerVfx } from "../director/registry";
import type { PropKind, Timeline, VfxApi } from "../director/types";
import { useUi3D } from "../uiStore";
import { buildClips } from "../procedural/character/clips";
import { buildCharacter } from "../procedural/character/cowboy";
import { DEFAULT_SPEC } from "../procedural/character/spec";
import { animateHorse, buildHorse } from "../procedural/props/horse";
import { buildBottle, buildGatlingWagon, buildStagecoach, buildTumbleweed } from "../procedural/props/props";

// Shared geometries: effects create meshes on demand and remove them when their timeline ends.
const SPHERE = new SphereGeometry(1, 12, 10);
const BULLET = new SphereGeometry(0.05, 8, 6);
const RING = new RingGeometry(0.75, 1.0, 40);
const DEBRIS = new IcosahedronGeometry(0.12, 0);

function material(color: string, opacity = 1): MeshBasicMaterial {
  return new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
}

/** A light source in the effect (flash, tracer, fireball): above 1.0 so bloom catches it (docs/05 §7). */
function hot(color: string, intensity: number, opacity = 1): MeshBasicMaterial {
  const m = material(color, opacity);
  m.color.multiplyScalar(intensity);
  m.toneMapped = false;
  return m;
}

/** A rider for Indians!: a saddled horse and a character held in the Ride pose. */
function buildRider(): { obj: Object3D; tick: (t: number) => void } {
  const horse = buildHorse({ saddle: true, coat: "#8a5a32" });
  const rider = buildCharacter(RIDER_SPEC);
  const mixer = new AnimationMixer(rider.group);
  const ride = buildClips().find((c) => c.name === "Ride");
  if (ride) {
    mixer.clipAction(ride).play();
    mixer.update(0.01);
  }
  rider.group.position.set(0, 0.55, -0.08);
  horse.group.add(rider.group);
  return { obj: horse.group, tick: (t) => animateHorse(horse, t, "gallop") };
}

const RIDER_SPEC = {
  ...DEFAULT_SPEC,
  coat: "none" as const,
  palette: { ...DEFAULT_SPEC.palette, shirt: "#a85a32", vest: "#4a3424", hat: "#3a2a1c", neckerchief: "#2a3a5a" },
  face: { ...DEFAULT_SPEC.face, mustache: "none" as const },
};

/**
 * Scene props (docs/05 §6): procedural models facing +Z, built from shared geometry and materials (so they are only
 * removed, never disposed). `tick` animates their parts (galloping legs) while they travel.
 */
function buildProp(kind: PropKind): { obj: Object3D; tick?: (t: number) => void } {
  switch (kind) {
    case "wagon":
      return { obj: buildGatlingWagon().group };
    case "stagecoach": {
      const coach = buildStagecoach();
      return { obj: coach.group, tick: (t) => coach.horses.forEach((h) => animateHorse(h, t, "gallop")) };
    }
    case "rider":
      return buildRider();
    case "tumbleweed":
      return { obj: buildTumbleweed().group };
    case "bottle":
      return { obj: buildBottle().group };
  }
}

function dispose(obj: Object3D): void {
  obj.removeFromParent();
  if (obj.userData.shared) return;
  obj.traverse((o) => {
    if (o instanceof Mesh) {
      const mats: Material[] = Array.isArray(o.material) ? o.material : [o.material];
      if (o.geometry !== CARD_GEOMETRY) mats.forEach((m) => m.dispose());
      if (![SPHERE, BULLET, RING, DEBRIS, CARD_GEOMETRY].includes(o.geometry)) o.geometry.dispose();
    }
  });
}

/** The VFX handle used by the Director (docs/05 §6–7): placeholders for flashes, tracers, dust, explosions… */
export function VfxLayer() {
  const root = useRef<Group>(null);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const group = root.current;
    if (!group) return;
    const spawn = (obj: Object3D, tl: Timeline): Timeline => {
      tl.call(() => {
        group.add(obj);
      }, undefined, 0);
      tl.call(() => dispose(obj));
      return tl;
    };

    const api: VfxApi = {
      muzzleFlash(at) {
        const m = new Mesh(SPHERE, hot("#ffd36b", 6));
        m.position.set(...at);
        m.scale.setScalar(0.01);
        const tl = gsap.timeline();
        tl.to(m.scale, { x: 0.35, y: 0.35, z: 0.35, duration: 0.05 }).to(m.material, { opacity: 0, duration: 0.12 }).to(m.scale, { x: 0.5, y: 0.5, z: 0.5, duration: 0.12 }, "<");
        return spawn(m, tl);
      },

      tracer(from, to, color = "#fff2c4") {
        const m = new Mesh(BULLET, hot(color, 3));
        m.position.set(...from);
        const tl = gsap.timeline();
        tl.to(m.position, { x: to[0], y: to[1], z: to[2], duration: 0.14, ease: "none" });
        return spawn(m, tl);
      },

      dust(at) {
        const g = new Group();
        g.position.set(...at);
        const tl = gsap.timeline();
        for (let i = 0; i < 7; i++) {
          const m = new Mesh(SPHERE, material("#c9a77a", 0.7));
          m.scale.setScalar(0.12);
          g.add(m);
          const a = (i / 7) * Math.PI * 2;
          tl.to(m.position, { x: Math.cos(a) * 0.6, y: 0.4 + (i % 3) * 0.15, z: Math.sin(a) * 0.6, duration: 0.6, ease: "power2.out" }, 0);
          tl.to(m.scale, { x: 0.3, y: 0.3, z: 0.3, duration: 0.6 }, 0);
          tl.to(m.material, { opacity: 0, duration: 0.6 }, 0);
        }
        return spawn(g, tl);
      },

      explosion(at) {
        const g = new Group();
        g.position.set(...at);
        const ball = new Mesh(SPHERE, hot("#ff8a2a", 4, 0.95));
        ball.scale.setScalar(0.1);
        g.add(ball);
        const tl = gsap.timeline();
        tl.to(ball.scale, { x: 1.6, y: 1.6, z: 1.6, duration: 0.25, ease: "power3.out" }, 0).to(ball.material, { opacity: 0, duration: 0.6 }, 0.2);
        for (let i = 0; i < 14; i++) {
          const d = new Mesh(DEBRIS, i % 2 ? material("#3a2a1c") : hot("#ffb347", 3));
          g.add(d);
          const a = (i / 14) * Math.PI * 2;
          tl.to(d.position, { x: Math.cos(a) * 2.2, y: 1 + (i % 4) * 0.4, z: Math.sin(a) * 2.2, duration: 0.8, ease: "power2.out" }, 0);
          tl.to(d.material, { opacity: 0, duration: 0.8 }, 0.1);
        }
        return spawn(g, tl);
      },

      glow(at, color) {
        const m = new Mesh(RING, material(color, 0.9));
        m.rotation.x = -Math.PI / 2;
        m.position.set(at[0], 0.05, at[2]);
        m.scale.setScalar(0.6);
        const tl = gsap.timeline();
        tl.to(m.scale, { x: 1.8, y: 1.8, z: 1.8, duration: 0.6, ease: "power2.out" }).to(m.material, { opacity: 0, duration: 0.6 }, "<");
        return spawn(m, tl);
      },

      cardFlight(cardId: CardId | null, from, to, duration = 0.45) {
        const mats = cardMaterials(cardId);
        const m = new Mesh(CARD_GEOMETRY, mats);
        m.position.set(...from);
        m.scale.setScalar(0.6);
        const peak = Math.max(from[1], to[1]) + 1.2;
        const tl = gsap.timeline();
        tl.to(m.position, { x: to[0], z: to[2], duration, ease: "power1.inOut" }, 0)
          .to(m.position, { y: peak, duration: duration / 2, ease: "power2.out" }, 0)
          .to(m.position, { y: to[1], duration: duration / 2, ease: "power2.in" }, duration / 2)
          .to(m.rotation, { x: -Math.PI / 2, y: Math.PI * 2, duration, ease: "power1.inOut" }, 0);
        tl.call(() => audio.sfx("card", from, { pitch: 0.9 + duration * 0.2 }), undefined, 0);
        tl.call(() => disposeCardMaterials(mats));
        return spawn(m, tl);
      },

      reveal(cardId, success, quick = false) {
        // The draw! card, big in front of the camera (docs/05 §4).
        const mats = cardMaterials(cardId, { unlit: true });
        const m = new Mesh(CARD_GEOMETRY, mats);
        m.scale.setScalar(0.01);
        const flash = new Mesh(SPHERE, material(success === false ? "#d0342c" : "#f2c14e", 0));
        flash.scale.setScalar(0.7);
        const g = new Group();
        g.add(m, flash);
        const tl = gsap.timeline();
        // Placed when it appears: an earlier camera shot in the same scene may have moved the camera.
        tl.call(
          () => {
            const dir = new Vector3();
            camera.getWorldDirection(dir);
            const at = camera.position.clone().add(dir.multiplyScalar(2.2));
            m.position.copy(at);
            m.quaternion.copy(camera.quaternion);
            flash.position.copy(at);
          },
          undefined,
          0,
        );
        tl.call(() => audio.sfx("card", undefined, { pitch: 0.8 }), undefined, 0);
        tl.to(m.scale, { x: 1, y: 1, z: 1, duration: 0.25, ease: "back.out(2)" });
        if (success === true) tl.call(() => audio.sfx("chime"));
        if (success === false) tl.call(() => audio.sfx("thud", undefined, { pitch: 0.7 }));
        if (success !== null) tl.to(flash.material, { opacity: 0.35, duration: 0.15, yoyo: true, repeat: 1 });
        tl.to({}, { duration: quick ? 0.05 : 0.35 }).to(m.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.2 });
        tl.call(() => disposeCardMaterials(mats));
        return spawn(g, tl);
      },

      prop(kind, from, to, duration) {
        const { obj, tick } = buildProp(kind);
        obj.userData.shared = true;
        obj.position.set(...from);
        // Procedural props face +Z: turn them toward where they are going.
        obj.rotation.y = Math.atan2(to[0] - from[0], to[2] - from[2]);
        const tl = gsap.timeline();
        const clock = { t: 0 };
        tl.to(obj.position, { x: to[0], y: to[1], z: to[2], duration, ease: "sine.inOut" });
        if (tick) tl.to(clock, { t: duration, duration, ease: "none", onUpdate: () => tick(clock.t) }, 0);
        if (kind === "tumbleweed") tl.to(obj.rotation, { x: 12, duration, ease: "none" }, 0);
        return spawn(obj, tl);
      },

      banner(text, duration, tone = "info") {
        const tl = gsap.timeline();
        tl.call(() => useUi3D.getState().setBanner({ text, tone }), undefined, 0);
        tl.to({}, { duration });
        tl.call(() => {
          if (useUi3D.getState().banner?.text === text) useUi3D.getState().setBanner(null);
        });
        return tl;
      },

      sound(cue, at) {
        const tl = gsap.timeline();
        tl.call(() => (cue === "duel" || cue === "victory" ? audio.stinger(cue) : audio.sfx(cue, at)), undefined, 0);
        return tl;
      },
    };
    return registerVfx(api);
  }, [camera]);

  return <group ref={root} />;
}
