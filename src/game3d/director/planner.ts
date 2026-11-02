import { cardType, isBlueCard, type CardType, type GameEvent } from "@/engine";

// Pure: which sequence stages which events (docs/05 §6 "matched in priority order"). Kept free of gsap/three so the
// catalogue coverage is unit-tested on hundreds of real games.

export type SequenceId =
  | "gameStarted"
  | "turnStarted"
  | "dynamite"
  | "jail"
  | "bang"
  | "gatling"
  | "gatlingShot"
  | "indians"
  | "indiansDefended"
  | "indiansHit"
  | "duel"
  | "duelRound"
  | "missed"
  | "damaged"
  | "beer"
  | "saloon"
  | "drawCards"
  | "generalStore"
  | "storePicked"
  | "panic"
  | "catBalou"
  | "equipped"
  | "jailed"
  | "eliminated"
  | "reward"
  | "gameOver"
  | "ability"
  | "healed"
  | "drawn"
  | "discarded"
  | "stolen"
  | "reshuffle"
  | "drawCheck"
  | "revealed"
  | "generic";

export interface Step {
  id: SequenceId;
  events: GameEvent[];
}

type Matcher = (events: readonly GameEvent[], i: number) => number;

const at = (events: readonly GameEvent[], i: number): GameEvent | undefined => events[i];

/** The type a CARD_PLAYED event resolves as (Calamity's Missed! as BANG! counts as BANG!). */
function playedAs(e: GameEvent | undefined): CardType | null {
  if (e?.t !== "CARD_PLAYED") return null;
  return e.asType ?? cardType(e.cardId);
}

/** Barrel / Jourdonnais checks right after a shot, each optionally followed by its MISSED. */
function barrelTail(events: readonly GameEvent[], i: number): number {
  let n = 0;
  for (;;) {
    const e = at(events, i + n);
    if (e?.t === "DRAW_CHECK" && (e.reason === "barrel" || e.reason === "jourdonnais")) {
      n += 1;
      if (at(events, i + n)?.t === "MISSED") n += 1;
      continue;
    }
    return n;
  }
}

function playedThen(type: CardType | ((t: CardType) => boolean), next?: GameEvent["t"]): Matcher {
  return (events, i) => {
    const as = playedAs(at(events, i));
    if (as === null || !(typeof type === "function" ? type(as) : as === type)) return 0;
    if (next && at(events, i + 1)?.t === next) return 2;
    return 1;
  };
}

/** In priority order; the first matcher returning > 0 consumes that many events. "generic" always matches. */
const MATCHERS: ReadonlyArray<readonly [SequenceId, Matcher]> = [
  ["gameStarted", (e, i) => (at(e, i)?.t === "GAME_STARTED" ? 1 : 0)],
  ["gameOver", (e, i) => (at(e, i)?.t === "GAME_OVER" ? 1 : 0)],
  ["turnStarted", (e, i) => (at(e, i)?.t === "TURN_STARTED" ? 1 : 0)],
  [
    "dynamite",
    (e, i) => {
      const c = at(e, i);
      if (c?.t !== "DRAW_CHECK" || c.reason !== "dynamite") return 0;
      const n = at(e, i + 1);
      if (n?.t === "DYNAMITE_PASSED") return 2;
      if (n?.t === "DYNAMITE_EXPLODED") return at(e, i + 2)?.t === "DAMAGED" ? 3 : 2;
      return 1;
    },
  ],
  [
    "jail",
    (e, i) => {
      const c = at(e, i);
      if (c?.t !== "DRAW_CHECK" || c.reason !== "jail") return 0;
      return at(e, i + 1)?.t === "JAIL_RESULT" ? 2 : 1;
    },
  ],
  [
    "bang",
    (e, i) => {
      const c = at(e, i);
      if (playedAs(c) !== "bang" || c?.t !== "CARD_PLAYED" || !c.target) return 0;
      const shot = at(e, i + 1)?.t === "SHOT" ? 1 : 0;
      return 1 + shot + barrelTail(e, i + 1 + shot);
    },
  ],
  [
    "gatling",
    (e, i) => {
      if (playedAs(at(e, i)) !== "gatling") return 0;
      const shot = at(e, i + 1)?.t === "SHOT" ? 1 : 0;
      return 1 + shot + barrelTail(e, i + 1 + shot);
    },
  ],
  [
    "gatlingShot",
    (e, i) => {
      const c = at(e, i);
      return c?.t === "SHOT" && c.source === "gatling" ? 1 + barrelTail(e, i + 1) : 0;
    },
  ],
  ["indians", playedThen("indians")],
  ["indiansDefended", (e, i) => (at(e, i)?.t === "INDIANS_DEFENDED" ? 1 : 0)],
  ["indiansHit", (e, i) => (at(e, i)?.t === "INDIANS_HIT" ? 1 : 0)],
  ["duel", playedThen("duel")],
  ["duelRound", (e, i) => (at(e, i)?.t === "DUEL_ROUND" ? (at(e, i + 1)?.t === "SHOT" ? 2 : 1) : 0)],
  // A Missed! (or Calamity's BANG!) played as a response, then its MISSED.
  [
    "missed",
    (e, i) => {
      const c = at(e, i);
      if (c?.t === "CARD_PLAYED" && !c.target && !c.asType && at(e, i + 1)?.t === "MISSED") return 2;
      return c?.t === "MISSED" ? 1 : 0;
    },
  ],
  ["damaged", (e, i) => (at(e, i)?.t === "DAMAGED" ? 1 : 0)],
  ["beer", playedThen("beer", "HEALED")],
  [
    "saloon",
    (e, i) => {
      if (playedAs(at(e, i)) !== "saloon") return 0;
      let n = 1;
      while (at(e, i + n)?.t === "HEALED") n++;
      return n;
    },
  ],
  [
    "drawCards",
    (e, i) => {
      const as = playedAs(at(e, i));
      if (as !== "stagecoach" && as !== "wells_fargo") return 0;
      let n = 1;
      if (at(e, i + n)?.t === "DECK_RESHUFFLED") n++;
      if (at(e, i + n)?.t === "CARDS_DRAWN") n++;
      return n;
    },
  ],
  [
    "generalStore",
    (e, i) => {
      if (playedAs(at(e, i)) !== "general_store") return 0;
      let n = 1;
      if (at(e, i + n)?.t === "DECK_RESHUFFLED") n++;
      if (at(e, i + n)?.t === "STORE_REVEALED") n++;
      return n;
    },
  ],
  ["storePicked", (e, i) => (at(e, i)?.t === "STORE_PICKED" ? 1 : 0)],
  ["panic", playedThen("panic", "CARD_STOLEN")],
  ["catBalou", playedThen("cat_balou", "CARD_DISCARDED")],
  ["jailed", playedThen("jail", "JAILED")],
  ["equipped", playedThen((type) => isBlueCard(type) && type !== "jail", "EQUIPPED")],
  [
    "eliminated",
    (e, i) => {
      if (at(e, i)?.t !== "ELIMINATED") return 0;
      const n = at(e, i + 1);
      return n?.t === "CARDS_INHERITED" || (n?.t === "CARD_DISCARDED" && n.reason === "eliminated") ? 2 : 1;
    },
  ],
  [
    "reward",
    (e, i) => {
      const r = at(e, i);
      if (r?.t !== "REWARD") return 0;
      const n = at(e, i + 1);
      if (r.kind === "outlaw_bounty" && n?.t === "CARDS_DRAWN") return 2;
      if (r.kind === "deputy_penalty" && n?.t === "CARD_DISCARDED") return 2;
      return 1;
    },
  ],
  [
    "ability",
    (e, i) => {
      if (at(e, i)?.t !== "ABILITY_USED") return 0;
      let n = 1;
      if (at(e, i + n)?.t === "CARD_DISCARDED") n++;
      if (at(e, i + n)?.t === "HEALED") n++;
      return n;
    },
  ],
  ["healed", (e, i) => (at(e, i)?.t === "HEALED" ? 1 : 0)],
  ["drawn", (e, i) => (at(e, i)?.t === "CARDS_DRAWN" || at(e, i)?.t === "CARDS_INHERITED" ? 1 : 0)],
  ["discarded", (e, i) => (at(e, i)?.t === "CARD_DISCARDED" ? 1 : 0)],
  ["stolen", (e, i) => (at(e, i)?.t === "CARD_STOLEN" ? 1 : 0)],
  ["reshuffle", (e, i) => (at(e, i)?.t === "DECK_RESHUFFLED" ? 1 : 0)],
  ["drawCheck", (e, i) => (at(e, i)?.t === "DRAW_CHECK" ? 1 : 0)],
  ["revealed", (e, i) => (at(e, i)?.t === "CARD_REVEALED" ? 1 : 0)],
  ["generic", () => 1],
];

/** Splits an update's events into consecutive steps, each staged by one sequence. Every event lands in exactly one. */
export function planSequences(events: readonly GameEvent[]): Step[] {
  const steps: Step[] = [];
  let i = 0;
  while (i < events.length) {
    for (const [id, match] of MATCHERS) {
      const n = match(events, i);
      if (n > 0) {
        steps.push({ id, events: events.slice(i, i + n) });
        i += n;
        break;
      }
    }
  }
  return steps;
}

/** Bookkeeping events with no scene of their own (docs/05 §6: "a generic quick animation"). */
export const QUIET_EVENTS: ReadonlySet<GameEvent["t"]> = new Set(["PHASE", "ROLE_ASSIGNED", "CHARACTER_CHOSEN", "SHOT", "CARD_PLAYED", "MISSED"]);
