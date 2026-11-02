import gsap from "gsap";
import type { ClipName, ClipOptions, Timeline } from "./types";

/** Anything with position / rotation / scale vectors (a three.js Object3D, or a plain object in tests). */
export interface RigTarget {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
}

/**
 * Procedural stand-ins for the shared Mixamo clips (docs/05 §5, §11): readable motions on a placeholder's animation
 * group, in its local frame (+z faces the center of the square). Every clip returns to the rest pose except the
 * held ones: Draw and Aim lean in until Shoot straightens up, and Death_*, SitJail, CoverCrouch and Lasso stay until
 * the rig reset (next presented view).
 */
export function clipTimeline(clip: ClipName, t: RigTarget, opts: ClipOptions = {}): Timeline {
  const tl = gsap.timeline();
  const p = t.position;
  const r = t.rotation;
  const s = t.scale;
  switch (clip) {
    case "Idle":
      tl.to({}, { duration: 0.1 });
      break;
    case "Think":
      tl.to(r, { y: "+=0.25", duration: 0.25, yoyo: true, repeat: 3, ease: "sine.inOut" });
      break;
    case "Draw":
      tl.to(s, { y: 1.06, duration: 0.12 }).to(s, { y: 1, duration: 0.12 }).to(r, { x: -0.06, duration: 0.15 });
      break;
    case "Aim":
      tl.to(r, { x: -0.12, duration: 0.25, ease: "power2.out" }).to({}, { duration: 0.25 });
      break;
    case "Shoot":
    case "ShootRifle": {
      const kick = clip === "ShootRifle" ? 0.28 : 0.16;
      tl.to(p, { z: `-=${kick}`, duration: 0.05 })
        .to(r, { x: 0.12, duration: 0.05 }, "<")
        .to(p, { z: `+=${kick}`, duration: 0.25, ease: "power2.out" })
        .to(r, { x: 0, duration: 0.25 }, "<");
      break;
    }
    case "HitReact":
      tl.to(p, { z: "-=0.35", duration: 0.08 })
        .to(r, { x: 0.35, duration: 0.08 }, "<")
        .to(p, { z: "+=0.35", duration: 0.4, ease: "power2.out" })
        .to(r, { x: 0, duration: 0.4 }, "<");
      break;
    case "Dodge":
      tl.to(p, { x: "+=0.9", y: "+=0.15", duration: 0.18, ease: "power2.out" })
        .to(r, { z: -0.6, duration: 0.18 }, "<")
        .to(p, { y: "-=0.15", duration: 0.12 })
        .to(p, { x: "-=0.9", duration: 0.35, ease: "power1.inOut" })
        .to(r, { z: 0, duration: 0.35 }, "<");
      break;
    case "CoverCrouch":
      tl.to(s, { y: 0.6, duration: 0.15 }).to(p, { x: "+=0.35", duration: 0.15 }, "<");
      break;
    case "Death_A":
      tl.to(r, { x: -1.5, duration: 0.9, ease: "power2.in" }).to(p, { y: 0.2, z: "-=0.4", duration: 0.9, ease: "power2.in" }, "<");
      break;
    case "Death_B":
      tl.to(r, { z: 1.5, duration: 0.9, ease: "power2.in" }).to(p, { y: 0.2, x: "+=0.4", duration: 0.9, ease: "power2.in" }, "<");
      break;
    case "Drink":
      tl.to(r, { x: 0.35, duration: 0.3 }).to({}, { duration: 0.5 }).to(r, { x: 0, duration: 0.3 });
      break;
    case "Cheer":
      tl.to(p, { y: "+=0.45", duration: 0.2, ease: "power2.out", yoyo: true, repeat: 3 });
      break;
    case "Throw":
      tl.to(r, { x: 0.3, duration: 0.2 }).to(r, { x: -0.25, duration: 0.12 }).to(r, { x: 0, duration: 0.25 });
      break;
    case "Grab":
      tl.to(p, { z: "+=0.8", duration: 0.2, ease: "power2.out" }).to(p, { z: "-=0.8", duration: 0.35 });
      break;
    case "Lasso":
      tl.to(r, { y: "+=6.283", duration: 0.7, ease: "power1.inOut" });
      break;
    case "SitJail":
      tl.to(s, { y: 0.7, duration: 0.3 }).to(r, { x: 0.25, duration: 0.3 }, "<");
      break;
    case "Taunt":
      tl.to(r, { z: 0.2, duration: 0.2, yoyo: true, repeat: 3, ease: "sine.inOut" });
      break;
    case "Shrug":
      tl.to(s, { y: 1.1, duration: 0.15, yoyo: true, repeat: 1 });
      break;
  }
  if (opts.speed && opts.speed !== 1) tl.timeScale(opts.speed);
  return tl;
}

export const ALL_CLIPS: readonly ClipName[] = [
  "Idle",
  "Think",
  "Draw",
  "Aim",
  "Shoot",
  "ShootRifle",
  "HitReact",
  "Dodge",
  "CoverCrouch",
  "Death_A",
  "Death_B",
  "Drink",
  "Cheer",
  "Throw",
  "Grab",
  "Lasso",
  "SitJail",
  "Taunt",
  "Shrug",
];
