import { cardType, equippedWeapon, type CardId, type GameEvent, type PlayerView, type Seat } from "@/engine";
import { GAME_TITLE } from "@/config/game";
import { t } from "@/ui/i18n";
import { BUILDINGS, type CameraPose, type Vec3 } from "../world/layout";
import type { SequenceId } from "./planner";
import type { DirectorContext, Timeline } from "./types";

// The sequence catalogue (docs/05 §6.1) for placeholders. Builders only compose rig / VFX / camera timelines from the
// context, so they work unchanged with real models later, and with fakes in unit tests. A sequence never decides
// anything about the game: it only stages events that already happened (docs/05 §6).

const DECK: Vec3 = [-0.6, 1.25, 0];
const DISCARD: Vec3 = [0.6, 1.25, 0];
const CENTER_HIGH: Vec3 = [0, 2.2, 0];
/** Duel lane at the front of the square, along the main street (docs/05 §2). */
const DUEL_A: Vec3 = [-5, 0, 9.5];
const DUEL_B: Vec3 = [5, 0, 9.5];
const DESERT_EDGE: Vec3 = [0, 1.6, -30];

const RIFLES = new Set(["winchester", "rev_carabine"]);

function building(id: string): Vec3 {
  const b = BUILDINGS.find((x) => x.id === id);
  return b ? [b.position[0], (b.size[1] ?? 4) * 0.6, b.position[2]] : [0, 2, -15];
}

function nameOf(view: PlayerView, seat: Seat): string {
  return seat === view.viewer ? t("table.you") : (view.players[seat]?.name ?? `#${seat}`);
}

function add(v: Vec3, d: Vec3): Vec3 {
  return [v[0] + d[0], v[1] + d[1], v[2] + d[2]];
}

/** Over-the-shoulder shot of `from` looking at `to` (docs/05 §6.1 BANG!). */
function overShoulder(ctx: DirectorContext, from: Seat, to: Seat): CameraPose {
  const a = ctx.seat(from);
  const b = ctx.seat(to);
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dz) || 1;
  const [ux, uz] = [dx / len, dz / len];
  // Behind and to the right of the shooter.
  return { position: [a[0] - ux * 2.8 - uz * 0.9, 2.4, a[2] - uz * 2.8 + ux * 0.9], target: ctx.chest(to) };
}

function closeUp(ctx: DirectorContext, seat: Seat): CameraPose {
  const p = ctx.seat(seat);
  const len = Math.hypot(p[0], p[2]) || 1;
  // From the center side, slightly above.
  return { position: [p[0] - (p[0] / len) * 3.4, 2.3, p[2] - (p[2] / len) * 3.4], target: ctx.chest(seat) };
}

const full = (ctx: DirectorContext) => ctx.mode === "full";

/** Several cards flying one after another (capped so big hands stay quick). */
function flights(ctx: DirectorContext, tl: Timeline, cards: (CardId | null)[], from: Vec3, to: Vec3, at: number | string = 0): void {
  cards.slice(0, 5).forEach((id, i) => tl.add(ctx.vfx.cardFlight(id, from, to, 0.45), typeof at === "number" ? at + i * 0.09 : `${at}+=${i * 0.09}`));
}

function inPlayCard(view: PlayerView, seat: Seat, type: string): CardId | null {
  return view.players[seat]?.inPlay.find((id) => cardType(id) === type) ?? null;
}

type Builder = (ctx: DirectorContext, events: GameEvent[]) => Timeline;

/** Shot + response tail shared by BANG!, Gatling and each Gatling target. */
function shootAt(ctx: DirectorContext, tl: Timeline, from: Seat, to: Seat, tail: GameEvent[], withPose: boolean): void {
  const shooter = ctx.rig(from);
  const rifle = RIFLES.has(equippedWeapon(ctx.view.players[from] ?? { inPlay: [] }) ?? "");
  if (shooter && withPose) {
    tl.add(shooter.face(ctx.seat(to), 0.2));
    // Short cinematics go straight to the shot.
    if (full(ctx)) {
      tl.add(shooter.play("Draw"));
      tl.add(shooter.play("Aim"));
    }
  }
  const fire = tl.duration();
  if (shooter) tl.add(shooter.play(rifle ? "ShootRifle" : "Shoot"), fire);
  tl.add(ctx.vfx.muzzleFlash(ctx.chest(from)), fire);
  tl.add(ctx.vfx.sound(rifle ? "rifle" : "gunshot", ctx.chest(from)), fire);
  tl.add(ctx.vfx.tracer(ctx.chest(from), ctx.chest(to)), fire + 0.02);
  // Short cinematics show only the deciding draw! (Jourdonnais + Barrel can make two; both are in the log).
  const checks = tail.filter((e) => e.t === "DRAW_CHECK");
  const shown = full(ctx) ? checks : checks.slice(-1);
  for (const e of tail) {
    if (e.t === "DRAW_CHECK" && shown.includes(e)) tl.add(ctx.vfx.reveal(e.chosen, e.success, !full(ctx)));
    if (e.t === "MISSED") {
      const target = ctx.rig(to);
      if (target) tl.add(target.play("CoverCrouch"));
      tl.add(ctx.vfx.dust(add(ctx.seat(to), [0, 0.4, 0])), "<");
      tl.add(ctx.vfx.sound("ricochet", ctx.seat(to)), "<");
    }
  }
}

const BUILDERS: Record<SequenceId, Builder> = {
  gameStarted(ctx) {
    const tl = ctx.timeline();
    if (full(ctx)) {
      tl.add(ctx.camera.shot({ position: [0, 26, 30], target: [0, 0, 0] }, 1.4));
      tl.add(ctx.vfx.banner(`${GAME_TITLE} — ${t("director.gameStarted")}`, 2.2, "gold"), 0);
      tl.add(ctx.camera.shot({ position: [12, 7, 12], target: [0, 1, 0] }, 1.6));
    } else tl.add(ctx.vfx.banner(t("director.gameStarted"), 1.2, "gold"));
    return tl;
  },

  turnStarted(ctx, [e]) {
    const tl = ctx.timeline();
    if (e?.t !== "TURN_STARTED") return tl;
    tl.add(ctx.vfx.banner(t("log.turn", { turn: e.turn, name: nameOf(ctx.view, e.seat) }), full(ctx) ? 1.0 : 0.6));
    tl.add(ctx.vfx.glow(ctx.seat(e.seat), "#f2b84b"), 0);
    return tl;
  },

  dynamite(ctx, events) {
    const tl = ctx.timeline();
    const check = events[0];
    if (check?.t !== "DRAW_CHECK") return tl;
    const seat = check.seat;
    if (full(ctx)) tl.add(ctx.camera.shot(closeUp(ctx, seat), 0.6));
    tl.add(ctx.vfx.sound("fuse", ctx.chest(seat)), 0);
    tl.add(ctx.vfx.reveal(check.chosen, check.success ? false : true, !full(ctx)));
    const result = events[1];
    if (result?.t === "DYNAMITE_PASSED") {
      const rig = ctx.rig(seat);
      if (rig) tl.add(rig.play("Throw"));
      tl.add(ctx.vfx.cardFlight(inPlayCard(ctx.view, seat, "dynamite"), ctx.crate(seat), ctx.crate(result.to), 0.7), "<0.15");
    } else if (result?.t === "DYNAMITE_EXPLODED") {
      tl.add(ctx.vfx.explosion(ctx.chest(seat)));
      tl.add(ctx.vfx.sound("explosion", ctx.chest(seat)), "<");
      if (full(ctx)) tl.add(ctx.camera.shake(0.35, 0.6), "<");
      const rig = ctx.rig(seat);
      if (rig) tl.add(rig.play("HitReact"), "<");
      tl.add(ctx.vfx.banner(t("director.dynamite", { name: nameOf(ctx.view, seat) }), 1.0, "danger"), "<");
    }
    return tl;
  },

  jail(ctx, events) {
    const tl = ctx.timeline();
    const check = events[0];
    if (check?.t !== "DRAW_CHECK") return tl;
    if (full(ctx)) tl.add(ctx.camera.shot(closeUp(ctx, check.seat), 0.5));
    tl.add(ctx.vfx.reveal(check.chosen, check.success, !full(ctx)));
    const rig = ctx.rig(check.seat);
    if (check.success) {
      if (rig) tl.add(rig.play("Cheer"));
    } else {
      if (rig) tl.add(rig.play("SitJail"));
      tl.add(ctx.vfx.sound("clank", ctx.seat(check.seat)), "<");
      tl.add(ctx.vfx.banner(t("director.skipped", { name: nameOf(ctx.view, check.seat) }), 1.0), "<");
    }
    return tl;
  },

  bang(ctx, events) {
    const tl = ctx.timeline();
    const played = events[0];
    if (played?.t !== "CARD_PLAYED" || played.target?.seat === undefined) return tl;
    const from = played.seat;
    const to = played.target.seat;
    if (full(ctx)) tl.add(ctx.camera.shot(overShoulder(ctx, from, to), 0.5));
    tl.add(ctx.vfx.cardFlight(played.cardId, ctx.chest(from), DISCARD, 0.45), 0);
    shootAt(ctx, tl, from, to, events.slice(2), true);
    return tl;
  },

  gatling(ctx, events) {
    const tl = ctx.timeline();
    const played = events[0];
    if (played?.t !== "CARD_PLAYED") return tl;
    const from = played.seat;
    const home = ctx.seat(from);
    if (full(ctx)) {
      tl.add(ctx.camera.shot({ position: [home[0] * 1.6, 5, home[2] * 1.6 + 2], target: [0, 1, 0] }, 0.6));
      tl.add(ctx.vfx.prop("wagon", add(home, [-6, 0, 0]), add(home, [-1.5, 0, 0]), 1.0), 0);
      tl.add(ctx.vfx.sound("gallop", home), 0);
    }
    tl.add(ctx.vfx.cardFlight(played.cardId, ctx.chest(from), DISCARD, 0.45), 0);
    const shot = events[1];
    if (shot?.t === "SHOT") shootAt(ctx, tl, from, shot.to, events.slice(2), false);
    return tl;
  },

  gatlingShot(ctx, events) {
    const tl = ctx.timeline();
    const shot = events[0];
    if (shot?.t !== "SHOT") return tl;
    shootAt(ctx, tl, shot.from, shot.to, events.slice(1), false);
    return tl;
  },

  indians(ctx, [played]) {
    const tl = ctx.timeline();
    if (played?.t !== "CARD_PLAYED") return tl;
    tl.add(ctx.vfx.banner(t("director.indians"), full(ctx) ? 2.0 : 1.0, "danger"));
    tl.add(ctx.vfx.sound("gallop", [0, 0, -10]), 0);
    if (full(ctx)) {
      tl.add(ctx.camera.shot({ position: [0, 9, 22], target: [0, 1, -10] }, 0.8), 0);
      // A dignified raid party crossing the square in a dust storm: neutral placeholder silhouettes (docs/05 §6.1).
      [0, 0.25, 0.5].forEach((d, i) => tl.add(ctx.vfx.prop("rider", [-30, 0, -12 + i * 3], [30, 0, -8 + i * 3], 1.8), d));
    }
    tl.add(ctx.vfx.dust([0, 0.5, -6]), 0.2);
    return tl;
  },

  indiansDefended(ctx, [e]) {
    const tl = ctx.timeline();
    if (e?.t !== "INDIANS_DEFENDED") return tl;
    const rig = ctx.rig(e.seat);
    if (rig) tl.add(rig.play("Shoot"));
    tl.add(ctx.vfx.muzzleFlash(ctx.chest(e.seat)), 0);
    tl.add(ctx.vfx.sound("gunshot", ctx.chest(e.seat)), 0);
    tl.add(ctx.vfx.tracer(ctx.chest(e.seat), DESERT_EDGE), 0.02);
    return tl;
  },

  indiansHit(ctx, [e]) {
    const tl = ctx.timeline();
    if (e?.t !== "INDIANS_HIT") return tl;
    tl.add(ctx.vfx.tracer(DESERT_EDGE, ctx.chest(e.seat), "#7a5230"));
    tl.add(ctx.vfx.sound("whoosh", ctx.chest(e.seat)), 0);
    const rig = ctx.rig(e.seat);
    if (rig) tl.add(rig.play("HitReact"));
    return tl;
  },

  duel(ctx, [played]) {
    const tl = ctx.timeline();
    if (played?.t !== "CARD_PLAYED" || played.target?.seat === undefined) return tl;
    const a = played.seat;
    const b = played.target.seat;
    tl.add(ctx.vfx.cardFlight(played.cardId, ctx.chest(a), DISCARD, 0.45), 0);
    tl.add(ctx.vfx.banner(t("director.duel", { a: nameOf(ctx.view, a), b: nameOf(ctx.view, b) }), full(ctx) ? 3.4 : 1.2, "gold"), 0);
    tl.add(ctx.vfx.sound("duel"), 0);
    const ra = ctx.rig(a);
    const rb = ctx.rig(b);
    if (!full(ctx)) {
      if (ra) tl.add(ra.play("Taunt"), 0);
      if (rb) tl.add(rb.play("Taunt"), 0);
      return tl;
    }
    // Sergio Leone, placeholder edition: walk out to the street, stare, walk back to the seats.
    tl.add(ctx.camera.shot({ position: [0, 2.2, 16], target: [0, 1.3, 9.5] }, 1.0), 0);
    if (ra) tl.add(ra.moveTo(DUEL_A, 1.1), 0);
    if (rb) tl.add(rb.moveTo(DUEL_B, 1.1), 0);
    if (ra) tl.add(ra.face(DUEL_B, 0.2));
    if (rb) tl.add(rb.face(DUEL_A, 0.2), "<");
    tl.add(ctx.vfx.prop("tumbleweed", [-9, 0.4, 11], [9, 0.4, 8.5], 1.4), "<");
    tl.add(ctx.vfx.sound("wind", [0, 0.5, 10]), "<");
    tl.add(ctx.camera.shot({ position: [DUEL_A[0] - 1.2, 1.9, DUEL_A[2] + 1.6], target: add(DUEL_B, [0, 1.6, 0]) }, 0.5), "<0.6");
    if (ra) tl.add(ra.moveTo(ctx.seat(a), 0.9));
    if (rb) tl.add(rb.moveTo(ctx.seat(b), 0.9), "<");
    return tl;
  },

  duelRound(ctx, events) {
    const tl = ctx.timeline();
    const round = events[0];
    if (round?.t !== "DUEL_ROUND") return tl;
    const prompt = ctx.view.prompt;
    const opponent = prompt?.kind === "DUEL" ? prompt.opponent : null;
    const rig = ctx.rig(round.seat);
    if (round.discarded) {
      // A quick draw that misses: spark in the dust next to the opponent.
      if (rig) tl.add(rig.play("Shoot"));
      tl.add(ctx.vfx.muzzleFlash(ctx.chest(round.seat)), 0);
      tl.add(ctx.vfx.sound("gunshot", ctx.chest(round.seat)), 0);
      if (opponent !== null) tl.add(ctx.vfx.dust(add(ctx.seat(opponent), [0.8, 0.1, 0.5])), 0.05);
      tl.add(ctx.vfx.cardFlight(round.discarded, ctx.chest(round.seat), DISCARD, 0.4), 0);
      return tl;
    }
    const shot = events[1];
    if (shot?.t === "SHOT") {
      const shooter = ctx.rig(shot.from);
      if (shooter) tl.add(shooter.play("Shoot"));
      tl.add(ctx.vfx.muzzleFlash(ctx.chest(shot.from)), 0);
      tl.add(ctx.vfx.sound("gunshot", ctx.chest(shot.from)), 0);
      tl.add(ctx.vfx.tracer(ctx.chest(shot.from), ctx.chest(shot.to)), 0.02);
    }
    return tl;
  },

  missed(ctx, events) {
    const tl = ctx.timeline();
    const missed = events.find((e) => e.t === "MISSED");
    const played = events[0]?.t === "CARD_PLAYED" ? events[0] : null;
    if (missed?.t !== "MISSED") return tl;
    if (played?.t === "CARD_PLAYED") tl.add(ctx.vfx.cardFlight(played.cardId, ctx.chest(played.seat), DISCARD, 0.4), 0);
    const rig = ctx.rig(missed.seat);
    if (rig) tl.add(rig.play(missed.via === "barrel" || missed.via === "jourdonnais" ? "CoverCrouch" : "Dodge"), 0);
    tl.add(ctx.vfx.dust(add(ctx.seat(missed.seat), [0, 0.3, 0])), 0.15);
    tl.add(ctx.vfx.sound("ricochet", ctx.seat(missed.seat)), 0.15);
    return tl;
  },

  damaged(ctx, [e]) {
    const tl = ctx.timeline();
    if (e?.t !== "DAMAGED") return tl;
    const rig = ctx.rig(e.seat);
    if (rig) tl.add(rig.play("HitReact"));
    tl.add(ctx.vfx.glow(ctx.seat(e.seat), "#d0342c"), 0);
    tl.add(ctx.vfx.sound("thud", ctx.chest(e.seat)), 0);
    if (full(ctx) && e.seat === ctx.mySeat) tl.add(ctx.camera.shake(0.15, 0.3), 0);
    return tl;
  },

  beer(ctx, [played]) {
    const tl = ctx.timeline();
    if (played?.t !== "CARD_PLAYED") return tl;
    tl.add(ctx.vfx.cardFlight(played.cardId, ctx.chest(played.seat), DISCARD, 0.4), 0);
    if (full(ctx)) tl.add(ctx.vfx.prop("bottle", ctx.crate(played.seat), ctx.chest(played.seat), 0.4), 0);
    const rig = ctx.rig(played.seat);
    if (rig) tl.add(rig.play("Drink"), 0.2);
    tl.add(ctx.vfx.sound("clink", ctx.chest(played.seat)), 0.2);
    tl.add(ctx.vfx.glow(ctx.seat(played.seat), "#4fd27a"), "<0.3");
    return tl;
  },

  saloon(ctx, events) {
    const tl = ctx.timeline();
    const played = events[0];
    if (played?.t !== "CARD_PLAYED") return tl;
    tl.add(ctx.vfx.cardFlight(played.cardId, ctx.chest(played.seat), DISCARD, 0.4), 0);
    tl.add(ctx.vfx.banner(t("director.saloon"), full(ctx) ? 2.0 : 1.0, "gold"), 0);
    tl.add(ctx.vfx.sound("clink", building("building.saloon")), 0);
    if (full(ctx)) tl.add(ctx.camera.shot({ position: [-7, 4, -6], target: building("building.saloon") }, 0.8), 0);
    const cheer = tl.duration();
    for (const p of ctx.next.players) {
      if (!p.alive) continue;
      const rig = ctx.rig(p.seat);
      if (rig && full(ctx)) tl.add(rig.play("Cheer"), cheer);
    }
    for (const e of events) if (e.t === "HEALED") tl.add(ctx.vfx.glow(ctx.seat(e.seat), "#4fd27a"), cheer);
    return tl;
  },

  drawCards(ctx, events) {
    const tl = ctx.timeline();
    const played = events[0];
    if (played?.t !== "CARD_PLAYED") return tl;
    const seat = played.seat;
    tl.add(ctx.vfx.cardFlight(played.cardId, ctx.chest(seat), DISCARD, 0.4), 0);
    if (full(ctx)) {
      if (cardType(played.cardId) === "stagecoach") {
        tl.add(ctx.vfx.prop("stagecoach", [-26, 0, 6], [26, 0, 6], 1.8), 0);
        tl.add(ctx.vfx.sound("gallop", [0, 0, 6]), 0);
      } else {
        tl.add(ctx.vfx.glow(building("building.bank"), "#f2d16b"), 0);
        tl.add(ctx.vfx.sound("chime", building("building.bank")), 0);
      }
    }
    const drawn = events.find((e) => e.t === "CARDS_DRAWN");
    if (drawn?.t === "CARDS_DRAWN") {
      const ids = drawn.cardIds ?? Array.from({ length: drawn.count }, () => null);
      flights(ctx, tl, ids, DECK, ctx.chest(seat), full(ctx) ? 0.9 : 0.2);
    }
    return tl;
  },

  generalStore(ctx, events) {
    const tl = ctx.timeline();
    const played = events[0];
    if (played?.t !== "CARD_PLAYED") return tl;
    tl.add(ctx.vfx.cardFlight(played.cardId, ctx.chest(played.seat), DISCARD, 0.4), 0);
    tl.add(ctx.vfx.banner(t("director.store"), full(ctx) ? 1.6 : 0.8), 0);
    tl.add(ctx.vfx.sound("bell", building("building.store")), 0);
    const revealed = events.find((e) => e.t === "STORE_REVEALED");
    if (revealed?.t === "STORE_REVEALED") flights(ctx, tl, revealed.cardIds, building("building.store"), CENTER_HIGH, 0.2);
    return tl;
  },

  storePicked(ctx, [e]) {
    const tl = ctx.timeline();
    if (e?.t !== "STORE_PICKED") return tl;
    tl.add(ctx.vfx.cardFlight(e.cardId, CENTER_HIGH, ctx.chest(e.seat), 0.5));
    return tl;
  },

  panic(ctx, events) {
    const tl = ctx.timeline();
    const played = events[0];
    const stolen = events[1];
    if (played?.t !== "CARD_PLAYED" || stolen?.t !== "CARD_STOLEN") return tl;
    tl.add(ctx.vfx.cardFlight(played.cardId, ctx.chest(played.seat), DISCARD, 0.4), 0);
    const rig = ctx.rig(played.seat);
    if (rig) {
      tl.add(rig.face(ctx.seat(stolen.from), 0.2), 0);
      tl.add(rig.play("Grab"));
    }
    const from = stolen.fromHand ? ctx.chest(stolen.from) : ctx.crate(stolen.from);
    tl.add(ctx.vfx.cardFlight(stolen.cardId ?? null, from, ctx.chest(stolen.to), 0.5), "<0.15");
    return tl;
  },

  catBalou(ctx, events) {
    const tl = ctx.timeline();
    const played = events[0];
    const discarded = events[1];
    if (played?.t !== "CARD_PLAYED" || discarded?.t !== "CARD_DISCARDED") return tl;
    tl.add(ctx.vfx.cardFlight(played.cardId, ctx.chest(played.seat), DISCARD, 0.4), 0);
    const rig = ctx.rig(played.seat);
    if (rig) {
      tl.add(rig.face(ctx.seat(discarded.seat), 0.2), 0);
      tl.add(rig.play("Lasso"));
    }
    tl.add(ctx.vfx.sound("whoosh", ctx.chest(played.seat)), "<");
    const from = played.target?.fromHand ? ctx.chest(discarded.seat) : ctx.crate(discarded.seat);
    flights(ctx, tl, discarded.cardIds, from, DISCARD, "<0.3");
    return tl;
  },

  equipped(ctx, events) {
    const tl = ctx.timeline();
    const eq = events[1];
    if (eq?.t !== "EQUIPPED") return tl;
    tl.add(ctx.vfx.cardFlight(eq.cardId, ctx.chest(eq.seat), ctx.crate(eq.seat), 0.5), 0);
    if (eq.replaced) tl.add(ctx.vfx.cardFlight(eq.replaced, ctx.crate(eq.seat), DISCARD, 0.5), 0.2);
    const rig = ctx.rig(eq.seat);
    if (rig && full(ctx)) tl.add(rig.play("Draw"), 0.3);
    return tl;
  },

  jailed(ctx, events) {
    const tl = ctx.timeline();
    const played = events[0];
    const jailed = events[1];
    if (played?.t !== "CARD_PLAYED" || jailed?.t !== "JAILED") return tl;
    if (full(ctx)) tl.add(ctx.camera.shot({ position: [7, 4, -8], target: building("building.sheriff") }, 0.7), 0);
    tl.add(ctx.vfx.cardFlight(played.cardId, ctx.chest(jailed.by), ctx.crate(jailed.seat), 0.6), 0);
    const rig = ctx.rig(jailed.seat);
    if (rig) tl.add(rig.play("SitJail"));
    tl.add(ctx.vfx.sound("clank", ctx.seat(jailed.seat)), "<");
    return tl;
  },

  eliminated(ctx, events) {
    const tl = ctx.timeline();
    const e = events[0];
    if (e?.t !== "ELIMINATED") return tl;
    if (full(ctx)) tl.add(ctx.camera.shot(closeUp(ctx, e.seat), 0.6));
    const rig = ctx.rig(e.seat);
    if (rig) tl.add(rig.play(e.seat % 2 === 0 ? "Death_A" : "Death_B", { speed: full(ctx) ? 0.7 : 1.5 }));
    tl.add(ctx.vfx.sound("bell", ctx.seat(e.seat)), "<");
    tl.add(ctx.vfx.banner(t("log.eliminated", { name: nameOf(ctx.view, e.seat), role: t(`role.${e.role}`) }), full(ctx) ? 1.8 : 1.0, "danger"), "<");
    const after = events[1];
    if (after?.t === "CARDS_INHERITED") {
      const ids: (CardId | null)[] = [...(after.handCardIds ?? Array.from({ length: after.handCount }, () => null)), ...after.inPlay];
      flights(ctx, tl, ids, ctx.chest(e.seat), ctx.chest(after.seat));
    } else if (after?.t === "CARD_DISCARDED") flights(ctx, tl, after.cardIds, ctx.chest(e.seat), DISCARD);
    return tl;
  },

  reward(ctx, events) {
    const tl = ctx.timeline();
    const r = events[0];
    if (r?.t !== "REWARD") return tl;
    const name = nameOf(ctx.view, r.seat);
    if (r.kind === "outlaw_bounty") {
      tl.add(ctx.vfx.banner(t("director.bounty", { name }), full(ctx) ? 1.6 : 0.9, "gold"));
      const drawn = events[1];
      if (drawn?.t === "CARDS_DRAWN") flights(ctx, tl, drawn.cardIds ?? Array.from({ length: drawn.count }, () => null), DECK, ctx.chest(r.seat), 0.3);
    } else {
      tl.add(ctx.vfx.banner(t("director.penalty", { name }), full(ctx) ? 1.6 : 0.9, "danger"));
      const lost = events[1];
      if (lost?.t === "CARD_DISCARDED") flights(ctx, tl, lost.cardIds, ctx.chest(r.seat), DISCARD, 0.3);
    }
    return tl;
  },

  gameOver(ctx, [e]) {
    const tl = ctx.timeline();
    if (e?.t !== "GAME_OVER") return tl;
    tl.add(ctx.vfx.banner(t(`winner.${e.winner}`), full(ctx) ? 3.0 : 1.5, "gold"));
    tl.add(ctx.vfx.sound("victory"), 0);
    if (full(ctx)) tl.add(ctx.camera.shot({ position: [0, 6, 18], target: [0, 1, 0] }, 1.2), 0);
    const winners = e.roles.flatMap((role, seat) =>
      (e.winner === "sheriff_team" && (role === "sheriff" || role === "deputy")) ||
      (e.winner === "outlaws" && role === "outlaw") ||
      (e.winner === "renegade" && role === "renegade")
        ? [seat]
        : [],
    );
    for (const seat of winners) {
      const rig = ctx.next.players[seat]?.alive ? ctx.rig(seat) : null;
      if (rig) tl.add(rig.play("Cheer"), 0.3);
    }
    return tl;
  },

  ability(ctx, events) {
    const tl = ctx.timeline();
    const used = events[0];
    if (used?.t !== "ABILITY_USED") return tl;
    const discarded = events.find((e) => e.t === "CARD_DISCARDED");
    if (discarded?.t === "CARD_DISCARDED") flights(ctx, tl, discarded.cardIds, ctx.chest(used.seat), DISCARD);
    tl.add(ctx.vfx.glow(ctx.seat(used.seat), "#4fd27a"), 0.2);
    return tl;
  },

  healed(ctx, [e]) {
    const tl = ctx.timeline();
    if (e?.t === "HEALED") tl.add(ctx.vfx.glow(ctx.seat(e.seat), "#4fd27a"));
    return tl;
  },

  drawn(ctx, [e]) {
    const tl = ctx.timeline();
    if (e?.t === "CARDS_DRAWN") {
      const from = e.from === "discard" ? DISCARD : e.from === "player" && e.fromSeat !== undefined ? ctx.chest(e.fromSeat) : DECK;
      // Face up only when the redacted event shows the ids: my own draws and public ones.
      flights(ctx, tl, e.cardIds ?? Array.from({ length: e.count }, () => null), from, ctx.chest(e.seat));
    } else if (e?.t === "CARDS_INHERITED") {
      flights(ctx, tl, [...(e.handCardIds ?? Array.from({ length: e.handCount }, () => null)), ...e.inPlay], ctx.chest(e.from), ctx.chest(e.seat));
    }
    return tl;
  },

  discarded(ctx, [e]) {
    const tl = ctx.timeline();
    if (e?.t === "CARD_DISCARDED") flights(ctx, tl, e.cardIds, ctx.chest(e.seat), DISCARD);
    return tl;
  },

  stolen(ctx, [e]) {
    const tl = ctx.timeline();
    if (e?.t === "CARD_STOLEN") tl.add(ctx.vfx.cardFlight(e.cardId ?? null, e.fromHand ? ctx.chest(e.from) : ctx.crate(e.from), ctx.chest(e.to), 0.5));
    return tl;
  },

  reshuffle(ctx) {
    const tl = ctx.timeline();
    flights(ctx, tl, [null, null, null, null], DISCARD, DECK);
    if (full(ctx)) tl.add(ctx.vfx.banner(t("director.reshuffle"), 0.9), 0);
    return tl;
  },

  drawCheck(ctx, [e]) {
    const tl = ctx.timeline();
    if (e?.t === "DRAW_CHECK") tl.add(ctx.vfx.reveal(e.chosen, e.success, !full(ctx)));
    return tl;
  },

  revealed(ctx, [e]) {
    const tl = ctx.timeline();
    if (e?.t === "CARD_REVEALED") tl.add(ctx.vfx.reveal(e.cardId, null, !full(ctx)));
    return tl;
  },

  generic(ctx) {
    return ctx.timeline();
  },
};

/** Card movements only, ≤ 0.4 s per event: what "cinematics off" still shows (docs/05 §6). */
function offBuild(ctx: DirectorContext, events: GameEvent[]): Timeline {
  const tl = ctx.timeline();
  for (const e of events) {
    if (e.t === "CARD_PLAYED") tl.add(ctx.vfx.cardFlight(e.cardId, ctx.chest(e.seat), DISCARD, 0.25), 0);
    if (e.t === "CARDS_DRAWN") tl.add(ctx.vfx.cardFlight(e.cardIds?.[0] ?? null, DECK, ctx.chest(e.seat), 0.25), 0);
    if (e.t === "CARD_DISCARDED") tl.add(ctx.vfx.cardFlight(e.cardIds[0] ?? null, ctx.chest(e.seat), DISCARD, 0.25), 0);
    if (e.t === "CARD_STOLEN") tl.add(ctx.vfx.cardFlight(e.cardId ?? null, ctx.chest(e.from), ctx.chest(e.to), 0.25), 0);
    if (e.t === "GAME_OVER") tl.add(ctx.vfx.sound("victory"), 0);
  }
  return tl;
}

export function buildStep(ctx: DirectorContext, id: SequenceId, events: GameEvent[]): Timeline {
  return ctx.mode === "off" ? offBuild(ctx, events) : BUILDERS[id](ctx, events);
}
