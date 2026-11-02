"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import gsap from "gsap";
import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
  type Material,
  type Object3D,
} from "three";
import type { CardId } from "@/engine";
import { CARD_GEOMETRY, cardMaterials, disposeCardMaterials } from "../cards/CardMesh";
import { registerVfx } from "../director/registry";
import type { PropKind, Timeline, VfxApi } from "../director/types";
import { useUi3D } from "../uiStore";
import type { Vec3 } from "../world/layout";

// Shared geometries: effects create meshes on demand and remove them when their timeline ends.
const SPHERE = new SphereGeometry(1, 12, 10);
const BULLET = new SphereGeometry(0.05, 8, 6);
const RING = new RingGeometry(0.75, 1.0, 40);
const DEBRIS = new IcosahedronGeometry(0.12, 0);

function material(color: string, opacity = 1): MeshBasicMaterial {
  return new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
}

/** A moving placeholder prop for scenes (docs/05 §11): boxes and capsules, tinted. */
function buildProp(kind: PropKind): Object3D {
  const g = new Group();
  const std = (color: string) => new MeshStandardMaterial({ color, roughness: 0.9 });
  const box = (size: Vec3, color: string, at: Vec3) => {
    const m = new Mesh(new BoxGeometry(...size), std(color));
    m.position.set(...at);
    m.castShadow = true;
    g.add(m);
  };
  switch (kind) {
    case "wagon":
      box([2.2, 0.8, 1.3], "#6b4a2b", [0, 0.9, 0]);
      box([0.25, 0.25, 1.4], "#2b2b2b", [0.6, 1.5, 0]); // the gun barrel
      break;
    case "stagecoach":
      box([3, 1.8, 1.6], "#7a2a20", [0, 1.4, 0]);
      box([1.6, 0.9, 0.5], "#6b4423", [2.4, 1.0, 0]); // horse
      break;
    case "rider": {
      box([1.6, 0.7, 0.5], "#5a4636", [0, 1.1, 0]);
      const rider = new Mesh(new CapsuleGeometry(0.25, 0.6, 4, 8), std("#6e6258"));
      rider.position.set(0, 1.9, 0);
      g.add(rider);
      break;
    }
    case "tumbleweed": {
      const m = new Mesh(new IcosahedronGeometry(0.45, 1), new MeshStandardMaterial({ color: "#a0814f", wireframe: true }));
      g.add(m);
      break;
    }
    case "bottle": {
      const m = new Mesh(new CylinderGeometry(0.07, 0.09, 0.32, 10), std("#3f7a4a"));
      g.add(m);
      break;
    }
  }
  return g;
}

function dispose(obj: Object3D): void {
  obj.removeFromParent();
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
        const m = new Mesh(SPHERE, material("#ffd36b"));
        m.position.set(...at);
        m.scale.setScalar(0.01);
        const tl = gsap.timeline();
        tl.to(m.scale, { x: 0.35, y: 0.35, z: 0.35, duration: 0.05 }).to(m.material, { opacity: 0, duration: 0.12 }).to(m.scale, { x: 0.5, y: 0.5, z: 0.5, duration: 0.12 }, "<");
        return spawn(m, tl);
      },

      tracer(from, to, color = "#fff2c4") {
        const m = new Mesh(BULLET, material(color));
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
        const ball = new Mesh(SPHERE, material("#ff8a2a", 0.95));
        ball.scale.setScalar(0.1);
        g.add(ball);
        const tl = gsap.timeline();
        tl.to(ball.scale, { x: 1.6, y: 1.6, z: 1.6, duration: 0.25, ease: "power3.out" }, 0).to(ball.material, { opacity: 0, duration: 0.6 }, 0.2);
        for (let i = 0; i < 14; i++) {
          const d = new Mesh(DEBRIS, material(i % 2 ? "#3a2a1c" : "#ffb347"));
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
        tl.to(m.scale, { x: 1, y: 1, z: 1, duration: 0.25, ease: "back.out(2)" });
        if (success !== null) tl.to(flash.material, { opacity: 0.35, duration: 0.15, yoyo: true, repeat: 1 });
        tl.to({}, { duration: quick ? 0.05 : 0.35 }).to(m.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.2 });
        tl.call(() => disposeCardMaterials(mats));
        return spawn(g, tl);
      },

      prop(kind, from, to, duration) {
        const obj = buildProp(kind);
        obj.position.set(...from);
        obj.rotation.y = Math.atan2(to[0] - from[0], to[2] - from[2]) - Math.PI / 2;
        const tl = gsap.timeline();
        tl.to(obj.position, { x: to[0], y: to[1], z: to[2], duration, ease: "sine.inOut" });
        if (kind === "tumbleweed") tl.to(obj.rotation, { z: -12, duration, ease: "none" }, 0);
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
    };
    return registerVfx(api);
  }, [camera]);

  return <group ref={root} />;
}
