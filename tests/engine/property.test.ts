import { describe, expect, it } from "vitest";
import {
  createGame,
  defaultActionOnTimeout,
  isActionLegal,
  redactEvent,
  toPlayerView,
  type CardId,
  type GameConfig,
  type GameEvent,
  type GameState,
  type Viewer,
} from "@/engine";
import { playRandom } from "./helpers/invariants";

const GAMES = 500;

/** Card ids `viewer` must never see: other players' hands, the deck, someone else's Kit Carlson pick. */
function hiddenIds(s: GameState, viewer: Viewer): Set<CardId> {
  const hidden = new Set<CardId>(s.deck);
  for (const p of s.players) if (p.seat !== viewer) p.hand.forEach((id) => hidden.add(id));
  for (const prompt of s.stack) {
    if (prompt.kind === "KIT_PICK" && prompt.seat !== viewer) prompt.cards.forEach((id) => hidden.add(id));
  }
  return hidden;
}

function viewLeaks(s: GameState, viewer: Viewer): string[] {
  const problems: string[] = [];
  const view = toPlayerView(s, viewer);
  const hidden = hiddenIds(s, viewer);
  for (const [, id] of JSON.stringify(view).matchAll(/"(c\d\d)"/g)) {
    if (hidden.has(id as CardId)) problems.push(`view of ${viewer} contains hidden card ${id}`);
  }
  for (const p of view.players) {
    const mayKnow = s.winner !== null || p.seat === viewer || !p.alive || s.players[p.seat]?.role === "sheriff";
    if (p.role !== null && !mayKnow) problems.push(`view of ${viewer} reveals role of seat ${p.seat}`);
  }
  if ("rng" in view || "deck" in view) problems.push("view exposes rng/deck");
  return problems;
}

function eventLeaks(event: GameEvent, viewer: Viewer): string[] {
  const r = redactEvent(event, viewer);
  if (r === null) return [];
  switch (event.t) {
    case "ROLE_ASSIGNED":
      return event.role !== "sheriff" && event.seat !== viewer ? [`role of ${event.seat} shown to ${viewer}`] : [];
    case "CARDS_DRAWN": {
      const mayKnow = event.from === "discard" || event.seat === viewer || (event.from === "player" && event.fromSeat === viewer);
      return !mayKnow && r.t === "CARDS_DRAWN" && r.cardIds ? [`drawn cards of ${event.seat} shown to ${viewer}`] : [];
    }
    case "CARD_STOLEN": {
      const mayKnow = !event.fromHand || event.from === viewer || event.to === viewer;
      return !mayKnow && r.t === "CARD_STOLEN" && r.cardId ? [`stolen card shown to ${viewer}`] : [];
    }
    case "CARDS_INHERITED": {
      const mayKnow = event.seat === viewer || event.from === viewer;
      return !mayKnow && r.t === "CARDS_INHERITED" && r.handCardIds ? [`inherited hand shown to ${viewer}`] : [];
    }
    default:
      return [];
  }
}

function config(i: number): GameConfig {
  const n = 4 + (i % 4);
  return {
    players: Array.from({ length: n }, (_, seat) => ({ name: `P${seat}`, isNpc: true, npcDifficulty: "easy" })),
    characterMode: i % 3 === 0 ? "choose_of_2" : "random",
  };
}

describe("property: random legal play over many seeded games", () => {
  it(`${GAMES} games keep every invariant, never leak hidden info, and always have a legal timeout action`, () => {
    let finished = 0;
    for (let i = 0; i < GAMES; i++) {
      const { state } = createGame(config(i), `property-${i}`);
      const viewers: Viewer[] = [...state.players.map((p) => p.seat), "spectator"];
      const problems: string[] = [];
      const result = playRandom(state, `property-actions-${i}`, 2000, (before, seat, _action, after, events) => {
        const timeout = defaultActionOnTimeout(before, seat);
        if (!isActionLegal(before, seat, timeout)) problems.push(`illegal timeout action ${JSON.stringify(timeout)}`);
        for (const viewer of viewers) {
          problems.push(...viewLeaks(after, viewer));
          for (const event of events) problems.push(...eventLeaks(event, viewer));
        }
      });
      if (problems.length > 0) throw new Error(`game ${i}: ${problems.slice(0, 5).join("; ")}`);
      if (result.state.winner) finished++;
    }
    // Random play is aimless, but with 80 cards and 4–7 players most games still end.
    expect(finished).toBeGreaterThan(GAMES * 0.8);
  }, 300_000);
});
