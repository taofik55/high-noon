"use client";

import gsap from "gsap";
import { AnimationMixer, LoopOnce, LoopRepeat, Object3D, Quaternion, Vector3, type AnimationAction, type AnimationClip } from "three";
import type { BuiltCharacter } from "../procedural/character/cowboy";
import { BONE } from "../procedural/character/skeleton";
import type { ClipName, RigApi, Timeline } from "../director/types";
import type { Vec3 } from "../world/layout";

/** Clips that end in a pose the character keeps until the next view resets the rig (as the placeholders did). */
const HELD = new Set<string>(["Draw", "Aim", "Death_A", "Death_B", "SitJail", "CoverCrouch", "Lasso"]);
/** Clips that need the gun in the hand from their first frame (Draw takes it out itself). */
const ARMED = new Set<string>(["Aim", "Shoot", "ShootRifle"]);
const FADE = 0.2;

export interface SkeletalRig extends RigApi {
  /** Advance the animation mixer (call every frame). */
  update(dt: number): void;
  /** Change the carried weapon (equipped weapon card); long guns sling across the back when not in use. */
  setGun(gun: Object3D, long: boolean): void;
  /** Dead characters rest in the last frame of their death fall. */
  setDead(dead: boolean): void;
  dispose(): void;
}

/**
 * The skeletal implementation of the Director's rig (docs/05 §5–6): clip names map to the shared skeleton's clips;
 * small root motions (sidesteps, knock-backs) and walks move the seat's animation group; the gun moves between
 * holster (or back sling) and hand. `group` is the seat's animation group; the character sits inside it.
 */
export function createSkeletalRig(group: Object3D, ch: BuiltCharacter, clips: readonly AnimationClip[]): SkeletalRig {
  const mixer = new AnimationMixer(ch.group);
  const byName = new Map(clips.map((c) => [c.name, c]));
  const actions = new Map<string, AnimationAction>(clips.map((c) => [c.name, mixer.clipAction(c)]));
  let current: AnimationAction | null = null;
  let dead = false;
  let gun: Object3D | null = null;
  let long = false;

  // Back sling for long guns: across the shoulder blades, side flat against the back, muzzle up and to the left.
  const sling = new Object3D();
  sling.name = "socket.sling";
  const spine2 = ch.skeleton.bones[BONE.Spine2] as Object3D;
  sling.position.set(0.02, 0.06, -0.17);
  sling.quaternion
    .setFromAxisAngle(new Vector3(0, 0, 1), 0.55)
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2))
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2));
  spine2.add(sling);

  const restSlot = () => (long ? sling : ch.hasHolster ? ch.sockets.holster : null);
  const gunTo = (where: "hand" | "rest") => {
    if (!gun) return;
    const slot = where === "hand" ? ch.sockets.rightHand : restSlot();
    if (slot) slot.add(gun);
    else gun.removeFromParent();
  };

  const fadeTo = (name: string, speed = 1) => {
    const next = actions.get(name) ?? actions.get("Idle");
    if (!next) return;
    const loop = name === "Idle" || name === "Walk" || name === "Ride";
    next.reset();
    next.setLoop(loop ? LoopRepeat : LoopOnce, Infinity);
    next.clampWhenFinished = !loop;
    next.timeScale = speed;
    next.enabled = true;
    next.setEffectiveWeight(1);
    if (current && current !== next) next.crossFadeFrom(current, FADE, false);
    else next.fadeIn(FADE);
    next.play();
    current = next;
  };

  /** Snap to the last frame of a death fall (no fade, no motion). */
  const deathPose = () => {
    mixer.stopAllAction();
    const a = actions.get("Death_A");
    if (!a) return;
    a.reset();
    a.setLoop(LoopOnce, 1);
    a.clampWhenFinished = true;
    a.play();
    a.time = a.getClip().duration;
    mixer.update(0);
    current = a;
  };

  const toLocal = (world: Vec3): Vector3 => {
    const parent = group.parent;
    const v = new Vector3(...world);
    if (!parent) return v;
    parent.updateWorldMatrix(true, false);
    return parent.worldToLocal(v);
  };

  const rig: SkeletalRig = {
    play(clip: ClipName, opts = {}): Timeline {
      const speed = opts.speed ?? 1;
      const c = byName.get(clip) ?? byName.get("Idle");
      const duration = (c?.duration ?? 0.5) / speed;
      const tl = gsap.timeline();
      tl.call(
        () => {
          fadeTo(clip, speed);
          if (ARMED.has(clip)) gunTo("hand");
        },
        [],
        0,
      );
      if (clip === "Draw") tl.call(() => gunTo("hand"), [], duration * 0.35);
      // Root motion the skeleton cannot do on its own.
      const p = group.position;
      if (clip === "Dodge") tl.to(p, { x: "+=0.7", duration: duration * 0.25, ease: "power2.out" }, 0).to(p, { x: "-=0.7", duration: duration * 0.4, ease: "power1.inOut" }, duration * 0.6);
      if (clip === "HitReact") tl.to(p, { z: "-=0.3", duration: 0.1 }, 0).to(p, { z: "+=0.3", duration: 0.45, ease: "power2.out" }, 0.1);
      if (clip === "Grab") tl.to(p, { z: "+=0.6", duration: duration * 0.3, ease: "power2.out" }, 0).to(p, { z: "-=0.6", duration: duration * 0.4 }, duration * 0.6);
      tl.to({}, { duration }, 0);
      if (!HELD.has(clip) && clip !== "Idle") tl.call(() => fadeTo("Idle"), [], duration);
      return tl;
    },

    moveTo(world, duration) {
      const tl = gsap.timeline();
      const target = toLocal(world);
      const dx = target.x - group.position.x;
      const dz = target.z - group.position.z;
      tl.call(() => fadeTo("Walk", Math.min(1.6, 0.9 + 0.12 * Math.hypot(dx, dz) / Math.max(0.3, duration))), [], 0);
      tl.to(group.rotation, { y: Math.atan2(dx, dz), duration: Math.min(0.25, duration / 3) }, 0);
      tl.to(group.position, { x: target.x, z: target.z, duration, ease: "sine.inOut" }, 0);
      tl.call(() => fadeTo("Idle"), [], duration);
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
      gunTo("rest");
      if (dead) {
        deathPose();
        return;
      }
      mixer.stopAllAction();
      current = null;
      fadeTo("Idle");
    },

    update(dt) {
      mixer.update(dt);
    },

    setGun(next, isLong) {
      const inHand = gun?.parent === ch.sockets.rightHand;
      gun?.removeFromParent();
      gun = next;
      long = isLong;
      gunTo(inHand ? "hand" : "rest");
    },

    setDead(value) {
      dead = value;
    },

    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(ch.group);
      sling.removeFromParent();
      gun?.removeFromParent();
    },
  };
  fadeTo("Idle");
  return rig;
}
