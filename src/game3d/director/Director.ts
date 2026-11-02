"use client";

import gsap from "gsap";
import type { PlayerView, Seat } from "@/engine";
import type { GameUpdate } from "@/net";
import type { PresentInfo, Presenter } from "@/ui/store/gameStore";
import { seatPosition, towardsCenter, type Vec3 } from "../world/layout";
import { planSequences } from "./planner";
import { getCamera, getRig, getVfx } from "./registry";
import { buildStep } from "./sequences";
import type { CameraApi, CinematicMode, DirectorContext, Timeline, VfxApi } from "./types";

export interface DirectorSettings {
  mode: CinematicMode;
  /** 1, 1.5 or 2 (docs/01 §6). */
  speed: number;
}

/** NPC "thinking" pause before its action is staged (docs/05 §6: 400–1200 ms, scaled by speed). */
export const THINK_MS: Record<CinematicMode, number> = { full: 800, short: 550, off: 400 };

const NO_TIMELINE = () => gsap.timeline();

/** Stand-ins when a handle is not mounted yet: everything still resolves, nothing is drawn. */
const NULL_VFX: VfxApi = {
  muzzleFlash: NO_TIMELINE,
  tracer: NO_TIMELINE,
  dust: NO_TIMELINE,
  explosion: NO_TIMELINE,
  glow: NO_TIMELINE,
  cardFlight: NO_TIMELINE,
  reveal: NO_TIMELINE,
  prop: NO_TIMELINE,
  banner: NO_TIMELINE,
};

/**
 * Plays every update as cinematic sequences before the HUD shows its result (docs/05 §6). Presentation only: it reads
 * views and events and never touches game state, so with cinematics off the game is exactly the same game.
 */
export class Director implements Presenter {
  private active: Timeline | null = null;
  private finish: (() => void) | null = null;

  constructor(
    private readonly settings: () => DirectorSettings,
    private readonly setCinematic: (on: boolean) => void,
  ) {}

  async present(update: GameUpdate, info: PresentInfo): Promise<void> {
    if (info.instant) return;
    const { mode, speed } = this.settings();
    const actor = update.actor;
    if (actor !== null && actor !== info.mySeat) {
      info.setThinking(actor);
      const thinker = getRig(actor);
      const pose = mode !== "off" && thinker ? thinker.play("Think") : null;
      await this.wait(THINK_MS[mode] / speed);
      pose?.progress(1);
      info.setThinking(null);
    }

    let cameraMoved = false;
    const cam = getCamera();
    const camera: CameraApi = {
      shot: (pose, d) => {
        cameraMoved = true;
        return cam ? cam.shot(pose, d) : gsap.timeline();
      },
      shake: (s, d) => (cam ? cam.shake(s, d) : gsap.timeline()),
    };
    const ctx = makeContext({ mode, mySeat: info.mySeat, view: info.prev, next: update.view, vfx: getVfx() ?? NULL_VFX, camera });
    const master = gsap.timeline({ paused: true });
    for (const step of planSequences(update.events)) master.add(buildStep(ctx, step.id, step.events));
    if (cameraMoved && cam) master.add(cam.home(0.6));
    if (master.duration() === 0) return;

    this.setCinematic(cameraMoved);
    try {
      await this.run(master, speed);
    } finally {
      this.setCinematic(false);
    }
  }

  skip(): void {
    this.active?.progress(1);
    this.finish?.();
  }

  private run(tl: Timeline, speed: number): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        if (this.active === tl) this.active = null;
        this.finish = null;
        resolve();
      };
      this.active = tl;
      this.finish = done;
      tl.eventCallback("onComplete", done);
      tl.timeScale(speed).play();
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.finish = null;
        resolve();
      }, ms);
      this.finish = () => {
        clearTimeout(timer);
        this.finish = null;
        resolve();
      };
    });
  }
}

interface ContextInput {
  mode: CinematicMode;
  mySeat: Seat;
  view: PlayerView;
  next: PlayerView;
  vfx: VfxApi;
  camera: CameraApi;
}

/** Builds the context sequences see: positions follow the same layout as the scene (world/layout.ts). */
export function makeContext({ mode, mySeat, view, next, vfx, camera }: ContextInput): DirectorContext {
  const n = view.players.length;
  const seat = (s: Seat): Vec3 => seatPosition(s, mySeat, n);
  return {
    mode,
    mySeat,
    view,
    next,
    seat,
    chest: (s) => {
      const p = seat(s);
      return [p[0], 1.2, p[2]];
    },
    crate: (s) => {
      const c = towardsCenter(seat(s), 1.6);
      return [c[0], 0.6, c[2]];
    },
    rig: getRig,
    vfx,
    camera,
    timeline: () => gsap.timeline(),
  };
}
