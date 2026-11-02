"use client";

import gsap from "gsap";
import { Vector3, type Object3D } from "three";
import { clipTimeline } from "../director/clips";
import type { RigApi } from "../director/types";
import type { Vec3 } from "../world/layout";

/**
 * Animation handle for one character's animation group (a child of the seat group, so +z faces the center).
 * Placeholder clips are procedural (director/clips.ts); a GLB character in Phase 12 implements the same API with
 * its Mixamo clips. All motion is an offset from the seat pose and reset() returns to it.
 */
export function createRig(group: Object3D): RigApi {
  const toLocal = (world: Vec3): Vector3 => {
    const parent = group.parent;
    const v = new Vector3(...world);
    if (!parent) return v;
    parent.updateWorldMatrix(true, false);
    return parent.worldToLocal(v);
  };

  return {
    play: (clip, opts) => clipTimeline(clip, group, opts),

    moveTo(world, duration) {
      const tl = gsap.timeline();
      const target = toLocal(world);
      const dx = target.x - group.position.x;
      const dz = target.z - group.position.z;
      tl.to(group.rotation, { y: Math.atan2(dx, dz), duration: Math.min(0.25, duration / 3) });
      tl.to(group.position, { x: target.x, z: target.z, duration, ease: "sine.inOut" }, 0);
      // A walking bob: an odd repeat count with yoyo ends back on the ground.
      const steps = Math.max(1, 2 * Math.round(duration / 0.32) - 1);
      tl.to(group.position, { y: 0.1, duration: duration / (steps + 1), yoyo: true, repeat: steps, ease: "sine.inOut" }, 0);
      return tl;
    },

    face(world, duration = 0.25) {
      const target = toLocal(world);
      const angle = Math.atan2(target.x - group.position.x, target.z - group.position.z);
      return gsap.timeline().to(group.rotation, { y: angle, duration });
    },

    reset() {
      gsap.killTweensOf([group.position, group.rotation, group.scale]);
      group.position.set(0, 0, 0);
      group.rotation.set(0, 0, 0);
      group.scale.set(1, 1, 1);
    },
  };
}
