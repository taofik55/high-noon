import gsap from "gsap";
import { describe, expect, it } from "vitest";
import { createGame, redactEvent, toPlayerView, type GameEvent, type GameState, type PlayerView } from "@/engine";
import { ALL_CLIPS, clipTimeline, type RigTarget } from "@/game3d/director/clips";
import { makeContext } from "@/game3d/director/Director";
import { QUIET_EVENTS, planSequences, type Step } from "@/game3d/director/planner";
import { buildStep } from "@/game3d/director/sequences";
import type { CameraApi, CinematicMode, DirectorContext, RigApi, VfxApi } from "@/game3d/director/types";
import { playRandom } from "../engine/helpers/invariants";

const wait = (d: number) => gsap.timeline().to({}, { duration: d });

/** Fake VFX/camera with the real effects' durations, so timing limits are checked without WebGL. */
const fakeVfx: VfxApi = {
  muzzleFlash: () => wait(0.17),
  tracer: () => wait(0.14),
  dust: () => wait(0.6),
  explosion: () => wait(0.9),
  glow: () => wait(0.6),
  cardFlight: (_c, _f, _t, d = 0.45) => wait(d),
  reveal: (_c, _s, quick) => wait(quick ? 0.75 : 1.05),
  prop: (_k, _f, _t, d) => wait(d),
  banner: (_t, d) => wait(d),
};
const fakeCamera: CameraApi = { shot: (_p, d) => wait(d), shake: (_s, d) => wait(d) };

function rest(): RigTarget {
  return { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
}

/** A rig on a plain object, playing the real procedural clips. */
function fakeRig(): RigApi {
  const target = rest();
  return {
    play: (clip, opts) => clipTimeline(clip, target, opts),
    moveTo: (_w, d) => wait(d),
    face: (_w, d = 0.25) => wait(d),
    reset: () => {},
  };
}

function ctxFor(mode: CinematicMode, prev: PlayerView, next: PlayerView): DirectorContext {
  const base = makeContext({ mode, mySeat: 0, view: prev, next, vfx: fakeVfx, camera: fakeCamera });
  const rigs = new Map<number, RigApi>();
  return { ...base, rig: (seat) => rigs.get(seat) ?? rigs.set(seat, fakeRig()).get(seat) ?? null };
}

interface Sample {
  prev: PlayerView;
  next: PlayerView;
  events: GameEvent[];
}

/** Real updates as seat 0 sees them: (view before, view after, redacted events), from seeded random games. */
function samples(games: number): Sample[] {
  const out: Sample[] = [];
  for (let g = 0; g < games; g++) {
    const { state } = createGame({ players: Array.from({ length: 4 + (g % 4) }, (_, s) => ({ name: `P${s}`, isNpc: s > 0 })), characterMode: "random" }, `dir-${g}`);
    playRandom(state, `dir-actions-${g}`, 1500, (before: GameState, _seat, _action, after: GameState, events) => {
      const visible = events.flatMap((e) => {
        const r = redactEvent(e, 0);
        return r ? [r] : [];
      });
      out.push({ prev: toPlayerView(before, 0), next: toPlayerView(after, 0), events: visible });
    });
  }
  return out;
}

const SAMPLES = samples(60);

describe("Director planner (docs/05 §6 matching)", () => {
  it("assigns every event to exactly one step, in order", () => {
    for (const s of SAMPLES) {
      const steps = planSequences(s.events);
      expect(steps.flatMap((st) => st.events)).toEqual(s.events);
      for (const st of steps) expect(st.events.length).toBeGreaterThan(0);
    }
  });

  it("gives every card and every game event a recognizable scene; only bookkeeping is generic", () => {
    const generic = new Set<string>();
    const seen = new Set<string>();
    for (const s of SAMPLES) {
      for (const st of planSequences(s.events)) {
        seen.add(st.id);
        if (st.id === "generic") st.events.forEach((e) => generic.add(e.t));
      }
    }
    for (const t of generic) expect(QUIET_EVENTS.has(t as GameEvent["t"])).toBe(true);
    for (const id of ["bang", "missed", "damaged", "beer", "panic", "catBalou", "gatling", "indians", "duel", "duelRound", "equipped", "jailed", "eliminated", "turnStarted"]) {
      expect(seen.has(id)).toBe(true);
    }
  });

  it("stages BANG! with its shot and Barrel checks as one scene", () => {
    const steps: Step[] = planSequences([
      { t: "CARD_PLAYED", seat: 0, cardId: "c01", target: { seat: 1 } },
      { t: "SHOT", from: 0, to: 1, source: "bang", weapon: "colt45" },
      { t: "DRAW_CHECK", seat: 1, reason: "barrel", cardIds: ["c23"], chosen: "c23", success: true },
      { t: "MISSED", seat: 1, via: "barrel" },
    ]);
    expect(steps.map((s) => [s.id, s.events.length])).toEqual([["bang", 4]]);
  });
});

describe("sequence timing per cinematics mode (docs/05 §6)", () => {
  const limits: Record<CinematicMode, (events: number) => number> = {
    full: () => 6,
    short: () => 2.5,
    off: (n) => 0.4 * n,
  };

  it.each(["full", "short", "off"] as const)("%s scenes stay within their time budget", (mode) => {
    let longest = 0;
    for (const s of SAMPLES) {
      const ctx = ctxFor(mode, s.prev, s.next);
      for (const st of planSequences(s.events)) {
        const d = buildStep(ctx, st.id, st.events).duration();
        longest = Math.max(longest, d);
        expect(d, `${mode} ${st.id}`).toBeLessThanOrEqual(limits[mode](st.events.length) + 1e-6);
      }
    }
    if (mode !== "off") expect(longest).toBeGreaterThan(0.5);
  });

  it("full scenes are longer than short ones for the big moments", () => {
    const duel = SAMPLES.find((s) => planSequences(s.events).some((st) => st.id === "duel"));
    expect(duel).toBeDefined();
    if (!duel) return;
    const step = planSequences(duel.events).find((st) => st.id === "duel");
    if (!step) return;
    const full = buildStep(ctxFor("full", duel.prev, duel.next), step.id, step.events).duration();
    const short = buildStep(ctxFor("short", duel.prev, duel.next), step.id, step.events).duration();
    expect(full).toBeGreaterThan(short);
  });
});

describe("procedural clips (docs/05 §5 names)", () => {
  it.each(ALL_CLIPS)("%s plays and returns to rest unless it is a held pose", (clip) => {
    const target = rest();
    const tl = clipTimeline(clip, target);
    expect(tl.duration()).toBeGreaterThan(0);
    tl.progress(1);
    const held = ["Draw", "Aim", "Death_A", "Death_B", "SitJail", "CoverCrouch", "Lasso"].includes(clip);
    if (!held) {
      expect(target.position.x).toBeCloseTo(0);
      expect(target.position.y).toBeCloseTo(0);
      expect(target.position.z).toBeCloseTo(0);
      expect(target.scale.y).toBeCloseTo(1);
      expect(target.rotation.x).toBeCloseTo(0);
    }
  });

  it("speed option shortens a clip", () => {
    // Measured in a parent timeline: a child's own timeScale is applied there.
    const normal = gsap.timeline().add(clipTimeline("Death_A", rest())).duration();
    const fast = gsap.timeline().add(clipTimeline("Death_A", rest(), { speed: 2 })).duration();
    expect(fast).toBeCloseTo(normal / 2);
  });
});
