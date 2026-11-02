import type gsap from "gsap";
import type { CardId, PlayerView, Seat } from "@/engine";
import type { CameraPose, Vec3 } from "../world/layout";

export type Timeline = gsap.core.Timeline;

export type CinematicMode = "full" | "short" | "off";

/**
 * Shared animation clip names (docs/05 §5). Placeholders implement them as procedural tweens (clips.ts); Phase 12
 * maps the same names to the Mixamo clips, so sequences never change.
 */
export type ClipName =
  | "Idle"
  | "Draw"
  | "Aim"
  | "Shoot"
  | "ShootRifle"
  | "HitReact"
  | "Dodge"
  | "CoverCrouch"
  | "Death_A"
  | "Death_B"
  | "Drink"
  | "Cheer"
  | "Throw"
  | "Grab"
  | "Lasso"
  | "SitJail"
  | "Taunt"
  | "Shrug"
  | "Think";

export interface ClipOptions {
  /** Playback speed factor for this clip (1 = normal). */
  speed?: number;
}

/** One character's animation handle. Everything it does is reset when the next presented view arrives. */
export interface RigApi {
  play(clip: ClipName, opts?: ClipOptions): Timeline;
  /** Walk (or run) to a world position, then stay there until the reset. */
  moveTo(world: Vec3, duration: number): Timeline;
  /** Turn to face a world position. */
  face(world: Vec3, duration?: number): Timeline;
  reset(): void;
}

export type PropKind = "wagon" | "stagecoach" | "rider" | "tumbleweed" | "bottle";

/** Short-lived visual effects; each returns a timeline that removes its objects when done. */
export interface VfxApi {
  muzzleFlash(at: Vec3): Timeline;
  tracer(from: Vec3, to: Vec3, color?: string): Timeline;
  dust(at: Vec3): Timeline;
  explosion(at: Vec3): Timeline;
  glow(at: Vec3, color: string): Timeline;
  /** A card flying along an arc; `cardId` null = face down. */
  cardFlight(cardId: CardId | null, from: Vec3, to: Vec3, duration?: number): Timeline;
  /**
   * The draw! card shown big in front of the camera; null = neutral, true = gold flash, false = red.
   * `quick` (short cinematics) holds it about half as long.
   */
  reveal(cardId: CardId, success: boolean | null, quick?: boolean): Timeline;
  /** A moving placeholder prop (Gatling wagon, stagecoach, riders, tumbleweed, bottle). */
  prop(kind: PropKind, from: Vec3, to: Vec3, duration: number): Timeline;
  /** A line of text over the scene (turn banner, "WANTED", winners). */
  banner(text: string, duration: number, tone?: "info" | "danger" | "gold"): Timeline;
}

export interface CameraApi {
  shot(pose: CameraPose, duration: number): Timeline;
  shake(strength: number, duration: number): Timeline;
}

/** What a sequence may use: the views, positions, and the rig / VFX / camera APIs. Never game state. */
export interface DirectorContext {
  mode: CinematicMode;
  mySeat: Seat;
  /** The view shown while the scene plays (before the update). */
  view: PlayerView;
  /** The view after the update (for e.g. who died, which weapon is now equipped). */
  next: PlayerView;
  seat(seat: Seat): Vec3;
  chest(seat: Seat): Vec3;
  crate(seat: Seat): Vec3;
  rig(seat: Seat): RigApi | null;
  vfx: VfxApi;
  camera: CameraApi;
  /** Newly created empty timeline. */
  timeline(): Timeline;
}
