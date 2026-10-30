import { describe, expect, it } from "vitest";
import {
  applyAction,
  currentActor,
  effectiveDistance,
  getLegalActions,
  type Action,
  type CardId,
  type GameState,
  type Seat,
} from "@/engine";
import { checkInvariants } from "./helpers/invariants";
import { eventsOf, firstInHand, handOf, player, run, scenario } from "./helpers/scenario";

const END_TURN = { type: "END_TURN" } as const;
const PASS = { type: "PASS" } as const;
const HEART = { suit: "hearts" } as const;
const SPADE = { suit: "spades" } as const;
const SPADE_5 = { suit: "spades", rank: 5 } as const;

function bang(s: GameState, from: Seat, to: Seat): [Seat, Action] {
  return [from, { type: "PLAY_CARD", cardId: firstInHand(s, from, "bang"), target: { seat: to } }];
}

describe("T-33 Bart Cassidy (R-17)", () => {
  it("draws 1 card per life point lost, right after the damage", () => {
    const s = scenario({ players: [{ hand: ["bang"] }, { character: "bart_cassidy" }, {}, {}] });
    const top = s.deck[0]!;
    const { state, events } = run(s, [bang(s, 0, 1), [1, PASS]]);
    expect(player(state, 1)).toMatchObject({ life: 3, hand: [top] });
    const i = events.findIndex((e) => e.t === "DAMAGED");
    expect(events[i + 1]).toEqual({ t: "CARDS_DRAWN", seat: 1, count: 1, cardIds: [top], from: "deck" });
  });

  it("draws 3 cards from a Dynamite explosion", () => {
    const s = scenario({ players: [{}, { character: "bart_cassidy", inPlay: ["dynamite"] }, {}, {}], deckTop: [SPADE_5] });
    const next3 = s.deck.slice(1, 4);
    const { state } = applyAction(s, 0, END_TURN);
    expect(player(state, 1).life).toBe(1);
    expect(player(state, 1).hand.slice(0, 3)).toEqual(next3);
    expect(player(state, 1).hand).toHaveLength(5); // + 2 in the draw phase
  });

  it("a Beer drawn by the hit can save him", () => {
    const s = scenario({ players: [{ hand: ["bang"] }, { character: "bart_cassidy", life: 1 }, {}, {}], deckTop: ["beer"] });
    const { state } = run(s, [bang(s, 0, 1), [1, PASS]]);
    expect(state.stack.at(-1)).toMatchObject({ kind: "DYING", seat: 1 });
    const beer = firstInHand(state, 1, "beer");
    const saved = applyAction(state, 1, { type: "RESPOND", cardIds: [beer] });
    expect(player(saved.state, 1)).toMatchObject({ alive: true, life: 1 });
  });
});

describe("T-34 Black Jack (R-18)", () => {
  it("shows the 2nd card; Hearts/Diamonds earn one more", () => {
    const s = scenario({ players: [{}, { character: "black_jack" }, {}, {}], deckTop: [SPADE, HEART, "panic"] });
    const [c1, c2, c3] = s.deck as [CardId, CardId, CardId];
    const { state, events } = applyAction(s, 0, END_TURN);
    expect(eventsOf(events, "CARD_REVEALED")).toEqual([{ t: "CARD_REVEALED", seat: 1, cardId: c2, reason: "black_jack" }]);
    expect(player(state, 1).hand).toEqual([c1, c2, c3]);
  });

  it("no extra card on Clubs/Spades", () => {
    const s = scenario({ players: [{}, { character: "black_jack" }, {}, {}], deckTop: [HEART, { suit: "clubs" }] });
    const { state, events } = applyAction(s, 0, END_TURN);
    expect(eventsOf(events, "CARD_REVEALED")).toHaveLength(1);
    expect(player(state, 1).hand).toHaveLength(2);
  });
});

describe("T-35 Calamity Janet (R-19)", () => {
  it("plays Missed! as BANG!: obeys range and counts toward the limit", () => {
    const s = scenario({ players: [{ character: "calamity_janet", hand: ["missed", "bang"] }, {}, {}, {}] });
    const missed = firstInHand(s, 0, "missed");
    expect(getLegalActions(s, 0)).toContainEqual({ type: "PLAY_CARD", cardId: missed, asType: "bang", targets: [{ seat: 1 }, { seat: 3 }] });
    expect(() => applyAction(s, 0, { type: "PLAY_CARD", cardId: missed })).toThrow(/cannot be played now/);
    expect(() => applyAction(s, 0, { type: "PLAY_CARD", cardId: missed, asType: "bang", target: { seat: 2 } })).toThrow(/not valid/);

    const shot = applyAction(s, 0, { type: "PLAY_CARD", cardId: missed, asType: "bang", target: { seat: 1 } });
    expect(eventsOf(shot.events, "CARD_PLAYED")).toEqual([
      { t: "CARD_PLAYED", seat: 0, cardId: missed, asType: "bang", target: { seat: 1 } },
    ]);
    expect(shot.state.stack.at(-1)).toMatchObject({ kind: "RESPOND_BANG", seat: 1, attacker: 0 });
    const after = applyAction(shot.state, 1, PASS).state;
    expect(after.turn.bangsPlayed).toBe(1);
    expect(getLegalActions(after, 0)).toEqual([{ type: "END_TURN" }]);
  });

  it("uses BANG! as Missed!", () => {
    const s = scenario({ players: [{ hand: ["bang"] }, { character: "calamity_janet", hand: ["bang"] }, {}, {}] });
    const own = firstInHand(s, 1, "bang");
    const { state } = run(s, [bang(s, 0, 1)]);
    expect(getLegalActions(state, 1)).toEqual([{ type: "RESPOND", cardIds: [own], count: 1 }, { type: "PASS" }]);
    const saved = applyAction(state, 1, { type: "RESPOND", cardIds: [own] });
    expect(eventsOf(saved.events, "MISSED")).toEqual([{ t: "MISSED", seat: 1, via: "calamity" }]);
    expect(player(saved.state, 1).life).toBe(player(s, 1).life);
  });

  it("discards Missed! against Indians! and in a Duel", () => {
    const s = scenario({ players: [{ hand: ["indians", "duel"] }, { character: "calamity_janet", hand: ["missed", "missed"] }, {}, {}] });
    const [m1, m2] = handOf(s, 1, "missed") as [CardId, CardId];
    let r = applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "indians") });
    r = applyAction(r.state, 1, { type: "RESPOND", cardIds: [m1] });
    expect(eventsOf(r.events, "INDIANS_DEFENDED")).toEqual([{ t: "INDIANS_DEFENDED", seat: 1, cardId: m1 }]);
    const done = run(r.state, [[2, PASS], [3, PASS]]).state;
    const duel = applyAction(done, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "duel"), target: { seat: 1 } });
    const round = applyAction(duel.state, 1, { type: "RESPOND", cardIds: [m2] });
    expect(eventsOf(round.events, "DUEL_ROUND")).toEqual([{ t: "DUEL_ROUND", seat: 1, discarded: m2 }]);
  });
});

describe("T-36 El Gringo (R-20)", () => {
  it("takes a random card from the attacker's hand per life point lost", () => {
    const s = scenario({
      players: [{ character: "black_jack", hand: ["bang", "beer", "panic"] }, { character: "el_gringo" }, {}, {}],
    });
    const { state, events } = run(s, [bang(s, 0, 1), [1, PASS]]);
    const [stolen] = eventsOf(events, "CARD_STOLEN");
    expect(stolen).toMatchObject({ from: 0, to: 1, fromHand: true });
    expect(player(state, 1).hand).toEqual([stolen?.cardId]);
    expect(player(state, 0).hand).toHaveLength(1);
    expect(checkInvariants(state)).toEqual([]);
  });

  it("gets nothing if the attacker's hand is empty, from Dynamite, or when the hit brings him to 0", () => {
    const empty = scenario({ players: [{ hand: ["bang"] }, { character: "el_gringo" }, {}, {}] });
    expect(eventsOf(run(empty, [bang(empty, 0, 1), [1, PASS]]).events, "CARD_STOLEN")).toEqual([]);

    const dyn = scenario({ players: [{ hand: ["beer"] }, { character: "el_gringo", inPlay: ["dynamite"], life: 4, maxLife: 4 }, {}, {}], deckTop: [SPADE_5] });
    expect(eventsOf(applyAction(dyn, 0, END_TURN).events, "CARD_STOLEN")).toEqual([]);

    const lethal = scenario({ players: [{ hand: ["bang", "beer"] }, { character: "el_gringo", life: 1 }, {}, {}] });
    const r = run(lethal, [bang(lethal, 0, 1), [1, PASS]]);
    expect(eventsOf(r.events, "CARD_STOLEN")).toEqual([]);
    expect(r.state.stack.at(-1)).toMatchObject({ kind: "DYING", seat: 1 });
  });

  it("takes from the opponent who wins a Duel against him", () => {
    const s = scenario({ players: [{ hand: ["duel", "beer"] }, { character: "el_gringo" }, {}, {}] });
    const { events } = run(s, [
      [0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "duel"), target: { seat: 1 } }],
      [1, PASS],
    ]);
    expect(eventsOf(events, "CARD_STOLEN")).toEqual([{ t: "CARD_STOLEN", from: 0, to: 1, cardId: firstInHand(s, 0, "beer"), fromHand: true }]);
  });
});

describe("T-37 Jesse Jones (R-21)", () => {
  const base = () => scenario({ players: [{}, { character: "jesse_jones" }, { hand: ["beer", "missed"] }, {}] });

  it("may take the first card from another player's hand, the second from the deck", () => {
    const s = base();
    const top = s.deck[0]!;
    const asked = applyAction(s, 0, END_TURN).state;
    expect(asked.stack.at(-1)).toEqual({ kind: "DRAW_CHOICE", seat: 1 });
    expect(getLegalActions(asked, 1)).toEqual([
      { type: "CHOOSE", choices: [{ kind: "draw", from: "deck" }, { kind: "draw", from: "player", seat: 2 }] },
    ]);
    const { state, events } = applyAction(asked, 1, { type: "CHOOSE", choice: { kind: "draw", from: "player", seat: 2 } });
    const [fromPlayer] = eventsOf(events, "CARDS_DRAWN");
    expect(fromPlayer).toMatchObject({ seat: 1, count: 1, from: "player", fromSeat: 2 });
    expect(player(base(), 2).hand).toContain(fromPlayer?.cardIds?.[0]);
    expect(player(state, 2).hand).toHaveLength(1);
    expect(player(state, 1).hand).toEqual([fromPlayer?.cardIds?.[0], top]);
    expect(state.turn).toMatchObject({ seat: 1, phase: "play" });
  });

  it("may draw normally instead", () => {
    const s = base();
    const top2 = s.deck.slice(0, 2);
    const asked = applyAction(s, 0, END_TURN).state;
    const { state } = applyAction(asked, 1, { type: "CHOOSE", choice: { kind: "draw", from: "deck" } });
    expect(player(state, 1).hand).toEqual(top2);
  });

  it("is not asked when nobody else has cards in hand", () => {
    const s = scenario({ players: [{}, { character: "jesse_jones" }, {}, {}] });
    const { state } = applyAction(s, 0, END_TURN);
    expect(state.turn).toMatchObject({ seat: 1, phase: "play" });
    expect(player(state, 1).hand).toHaveLength(2);
  });
});

describe("T-38 Jourdonnais (R-9)", () => {
  it("built-in Barrel is checked first, then the real one", () => {
    const s = scenario({ players: [{ hand: ["bang"] }, { character: "jourdonnais", inPlay: ["barrel"] }, {}, {}], deckTop: [SPADE, HEART] });
    const { state, events } = run(s, [bang(s, 0, 1)]);
    expect(eventsOf(events, "DRAW_CHECK").map((e) => [e.reason, e.success])).toEqual([
      ["jourdonnais", false],
      ["barrel", true],
    ]);
    expect(eventsOf(events, "MISSED")).toEqual([{ t: "MISSED", seat: 1, via: "barrel" }]);
    expect(currentActor(state)).toBe(0);
  });

  it("stops as soon as enough Missed! effects are reached", () => {
    const s = scenario({ players: [{ hand: ["bang"] }, { character: "jourdonnais", inPlay: ["barrel"] }, {}, {}], deckTop: [HEART] });
    const { events } = run(s, [bang(s, 0, 1)]);
    expect(eventsOf(events, "DRAW_CHECK")).toHaveLength(1);
    expect(eventsOf(events, "MISSED")).toEqual([{ t: "MISSED", seat: 1, via: "jourdonnais" }]);
  });

  it("two successes cancel Slab the Killer's BANG!", () => {
    const s = scenario({
      players: [{ character: "slab_the_killer", hand: ["bang"] }, { character: "jourdonnais", inPlay: ["barrel"] }, {}, {}],
      deckTop: [HEART, HEART],
    });
    const { state } = run(s, [bang(s, 0, 1)]);
    expect(currentActor(state)).toBe(0);
    expect(player(state, 1).life).toBe(player(s, 1).life);
  });
});

describe("T-39 Kit Carlson (R-22)", () => {
  it("looks at the top 3, keeps 2 and puts the other back on top", () => {
    const s = scenario({ players: [{}, { character: "kit_carlson" }, {}, {}], deckTop: ["beer", "panic", "missed"] });
    const [beer, panic, missed] = s.deck as [CardId, CardId, CardId];
    const asked = applyAction(s, 0, END_TURN).state;
    expect(asked.stack.at(-1)).toEqual({ kind: "KIT_PICK", seat: 1, cards: [beer, panic, missed] });
    expect(checkInvariants(asked)).toEqual([]);
    const { state, events } = applyAction(asked, 1, { type: "CHOOSE", choice: { kind: "kit_return", cardId: panic } });
    expect(player(state, 1).hand).toEqual([beer, missed]);
    expect(state.deck[0]).toBe(panic);
    expect(eventsOf(events, "CARDS_DRAWN")).toEqual([{ t: "CARDS_DRAWN", seat: 1, count: 2, cardIds: [beer, missed], from: "deck" }]);
    expect(state.turn).toMatchObject({ seat: 1, phase: "play" });
  });

  it("keeps everything without a prompt when fewer than 3 cards are available", () => {
    const s = scenario({ players: [{}, { character: "kit_carlson" }, {}, {}], deckTop: ["beer", "panic"], leftover: "none" });
    const { state } = applyAction(s, 0, END_TURN);
    expect(player(state, 1).hand).toEqual(s.deck);
    expect(state.turn.phase).toBe("play");
  });
});

describe("T-40 Lucky Duke (R-23)", () => {
  it("flips 2 for a Barrel and keeps the Heart", () => {
    const s = scenario({ players: [{ hand: ["bang"] }, { character: "lucky_duke", inPlay: ["barrel"] }, {}, {}], deckTop: [SPADE, HEART] });
    const [spade, heart] = s.deck as [CardId, CardId];
    const { state, events } = run(s, [bang(s, 0, 1)]);
    expect(eventsOf(events, "DRAW_CHECK")).toEqual([
      { t: "DRAW_CHECK", seat: 1, reason: "barrel", cardIds: [spade, heart], chosen: heart, success: true },
    ]);
    expect(state.discard.slice(-2)).toEqual([spade, heart]);
  });

  it("avoids a Dynamite explosion when one card is safe, and escapes Jail on any Heart", () => {
    const dyn = scenario({ players: [{}, { character: "lucky_duke", inPlay: ["dynamite"] }, {}, {}], deckTop: [SPADE_5, HEART] });
    const r1 = applyAction(dyn, 0, END_TURN);
    expect(eventsOf(r1.events, "DYNAMITE_PASSED")).toHaveLength(1);
    expect(eventsOf(r1.events, "DRAW_CHECK")[0]).toMatchObject({ chosen: dyn.deck[1], success: false });

    const both = scenario({
      players: [{}, { character: "lucky_duke", inPlay: ["dynamite"] }, {}, {}],
      deckTop: [SPADE_5, { suit: "spades", rank: 6 }],
    });
    expect(eventsOf(applyAction(both, 0, END_TURN).events, "DYNAMITE_EXPLODED")).toHaveLength(1);

    const jail = scenario({ players: [{}, { character: "lucky_duke", inPlay: ["jail"] }, {}, {}], deckTop: [SPADE, HEART] });
    expect(eventsOf(applyAction(jail, 0, END_TURN).events, "JAIL_RESULT")).toEqual([{ t: "JAIL_RESULT", seat: 1, escaped: true }]);
  });
});

describe("T-41 Paul Regret / T-43 Rose Doolan (R-2)", () => {
  it("T-41 Paul Regret is seen 1 further away", () => {
    const s = scenario({ players: [{ hand: ["bang"] }, { character: "paul_regret" }, {}, {}] });
    expect(effectiveDistance(s, 0, 1)).toBe(2);
    expect(getLegalActions(s, 0)).toContainEqual({ type: "PLAY_CARD", cardId: firstInHand(s, 0, "bang"), targets: [{ seat: 3 }] });
  });

  it("T-43 Rose Doolan sees everyone 1 closer", () => {
    const s = scenario({ players: [{ character: "rose_doolan", hand: ["bang"] }, {}, {}, {}, {}] });
    expect(effectiveDistance(s, 0, 2)).toBe(1);
    expect(getLegalActions(s, 0)).toContainEqual({
      type: "PLAY_CARD",
      cardId: firstInHand(s, 0, "bang"),
      targets: [1, 2, 3, 4].map((seat) => ({ seat })),
    });
  });
});

describe("T-42 Pedro Ramirez (R-24)", () => {
  it("may take the top of the discard pile first", () => {
    const s = scenario({ players: [{}, { character: "pedro_ramirez" }, {}, {}], discard: ["missed", "beer"] });
    const beer = s.discard.at(-1)!;
    const top = s.deck[0]!;
    const asked = applyAction(s, 0, END_TURN).state;
    expect(getLegalActions(asked, 1)).toEqual([{ type: "CHOOSE", choices: [{ kind: "draw", from: "deck" }, { kind: "draw", from: "discard" }] }]);
    const { state, events } = applyAction(asked, 1, { type: "CHOOSE", choice: { kind: "draw", from: "discard" } });
    expect(player(state, 1).hand).toEqual([beer, top]);
    expect(eventsOf(events, "CARDS_DRAWN")[0]).toEqual({ t: "CARDS_DRAWN", seat: 1, count: 1, cardIds: [beer], from: "discard" });
  });

  it("is not asked when the discard pile is empty", () => {
    const s = scenario({ players: [{}, { character: "pedro_ramirez" }, {}, {}] });
    const { state } = applyAction(s, 0, END_TURN);
    expect(state.turn.phase).toBe("play");
  });
});

describe("T-44 Sid Ketchum (R-25)", () => {
  it("discards 2 cards to regain 1 life, any number of times", () => {
    const s = scenario({ players: [{ character: "sid_ketchum", life: 2, hand: ["bang", "missed", "panic", "beer"] }, {}, {}, {}] });
    expect(getLegalActions(s, 0)).toContainEqual({ type: "ABILITY", ability: "sid_ketchum", cardIds: player(s, 0).hand, count: 2 });
    const [a, b, c, d] = player(s, 0).hand as [CardId, CardId, CardId, CardId];
    const { state, events } = run(s, [
      [0, { type: "ABILITY", ability: "sid_ketchum", cardIds: [a, b] }],
      [0, { type: "ABILITY", ability: "sid_ketchum", cardIds: [c, d] }],
    ]);
    expect(player(state, 0)).toMatchObject({ life: 4, hand: [] });
    expect(eventsOf(events, "HEALED").map((e) => e.cause)).toEqual(["sid", "sid"]);
    expect(eventsOf(events, "ABILITY_USED")).toHaveLength(2);
    expect(currentActor(state)).toBe(0);
  });

  it("is not offered at full life or with fewer than 2 cards", () => {
    const full = scenario({ players: [{ character: "sid_ketchum", hand: ["bang", "missed"] }, {}, {}, {}] });
    expect(getLegalActions(full, 0).some((l) => l.type === "ABILITY")).toBe(false);
    const oneCard = scenario({ players: [{ character: "sid_ketchum", life: 1, hand: ["bang"] }, {}, {}, {}] });
    expect(getLegalActions(oneCard, 0).some((l) => l.type === "ABILITY")).toBe(false);
  });

  it("can save himself while dying, even with only 2 players alive", () => {
    const s = scenario({
      players: [{ hand: ["bang"] }, { character: "sid_ketchum", life: 1, hand: ["panic", "beer"] }, { alive: false }, { alive: false, role: "deputy" }],
    });
    const dying = run(s, [bang(s, 0, 1), [1, PASS]]).state;
    expect(getLegalActions(dying, 1)).toEqual([{ type: "PASS" }, { type: "ABILITY", ability: "sid_ketchum", cardIds: player(s, 1).hand, count: 2 }]);
    const { state } = applyAction(dying, 1, { type: "ABILITY", ability: "sid_ketchum", cardIds: player(s, 1).hand });
    expect(player(state, 1)).toMatchObject({ alive: true, life: 1 });
    expect(currentActor(state)).toBe(0);
  });

  it("recomputes the discard-phase count after using the ability", () => {
    const s = scenario({ players: [{ character: "sid_ketchum", life: 2, hand: ["bang", "missed", "panic", "beer", "duel"] }, {}, {}, {}] });
    const asked = applyAction(s, 0, END_TURN).state;
    expect(asked.stack.at(-1)).toEqual({ kind: "DISCARD_EXCESS", seat: 0, count: 3 });
    const [a, b] = player(s, 0).hand as [CardId, CardId];
    const { state } = applyAction(asked, 0, { type: "ABILITY", ability: "sid_ketchum", cardIds: [a, b] });
    expect(player(state, 0)).toMatchObject({ life: 3 });
    expect(player(state, 0).hand).toHaveLength(3);
    expect(state.turn.seat).toBe(1);
  });
});

describe("T-45 Slab the Killer (R-10, R-26)", () => {
  it("needs 2 Missed! effects; one Missed! is not enough", () => {
    const s = scenario({ players: [{ character: "slab_the_killer", hand: ["bang"] }, { hand: ["missed", "missed"] }, {}, {}] });
    const missed = handOf(s, 1, "missed");
    const { state } = run(s, [bang(s, 0, 1)]);
    expect(state.stack.at(-1)).toMatchObject({ kind: "RESPOND_BANG", needed: 2, got: 0 });
    expect(() => applyAction(state, 1, { type: "RESPOND", cardIds: [missed[0]!] })).toThrow(/exactly 2/);
    const saved = applyAction(state, 1, { type: "RESPOND", cardIds: missed });
    expect(eventsOf(saved.events, "MISSED")).toHaveLength(2);
    expect(player(saved.state, 1).life).toBe(player(s, 1).life);

    const one = scenario({ players: [{ character: "slab_the_killer", hand: ["bang"] }, { hand: ["missed"] }, {}, {}] });
    expect(getLegalActions(run(one, [bang(one, 0, 1)]).state, 1)).toEqual([{ type: "PASS" }]);
  });

  it("a Barrel success plus one Missed! is enough (R-10)", () => {
    const s = scenario({
      players: [{ character: "slab_the_killer", hand: ["bang"] }, { hand: ["missed"], inPlay: ["barrel"] }, {}, {}],
      deckTop: [HEART],
    });
    const { state } = run(s, [bang(s, 0, 1)]);
    expect(state.stack.at(-1)).toMatchObject({ kind: "RESPOND_BANG", needed: 2, got: 1 });
    expect(getLegalActions(state, 1)[0]).toEqual({ type: "RESPOND", cardIds: handOf(s, 1, "missed"), count: 1 });
  });
});

describe("T-46 Suzy Lafayette (R-27)", () => {
  it("draws as soon as her hand is empty, even out of turn", () => {
    const s = scenario({ players: [{ hand: ["bang"] }, { character: "suzy_lafayette", hand: ["missed"] }, {}, {}] });
    const top = s.deck[0]!;
    const { state, events } = run(s, [bang(s, 0, 1), [1, { type: "RESPOND", cardIds: handOf(s, 1, "missed") }]]);
    expect(player(state, 1).hand).toEqual([top]);
    expect(eventsOf(events, "CARDS_DRAWN")).toEqual([{ t: "CARDS_DRAWN", seat: 1, count: 1, cardIds: [top], from: "deck" }]);
  });

  it("draws after playing her last card on her own turn", () => {
    const s = scenario({ players: [{ character: "suzy_lafayette", life: 2, hand: ["beer"] }, {}, {}, {}] });
    const { state } = applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "beer") });
    expect(player(state, 0).hand).toEqual([s.deck[0]]);
  });

  it("does not draw once eliminated", () => {
    const s = scenario({ players: [{ hand: ["bang"] }, { character: "suzy_lafayette", life: 1, hand: ["missed"] }, {}, {}] });
    const { state } = run(s, [bang(s, 0, 1), [1, PASS], [1, PASS]]);
    expect(player(state, 1)).toMatchObject({ alive: false, hand: [] });
  });
});

describe("T-47 Vulture Sam (R-28) / T-28", () => {
  it("takes all cards of an eliminated player into his hand, before the reward", () => {
    // The victim's Mustang puts them at distance 2, hence the Sheriff's Schofield.
    const s = scenario({
      players: [
        { role: "sheriff", hand: ["bang"], inPlay: ["schofield"] },
        { role: "outlaw", life: 1, hand: ["beer", "missed"], inPlay: ["mustang"] },
        { role: "outlaw", character: "vulture_sam" },
        { role: "renegade" },
      ],
    });
    const victimHand = player(s, 1).hand;
    const victimInPlay = player(s, 1).inPlay;
    const { state, events } = run(s, [bang(s, 0, 1), [1, PASS], [1, PASS]]);
    expect(player(state, 2).hand).toEqual([...victimHand, ...victimInPlay]);
    expect(eventsOf(events, "CARDS_INHERITED")).toEqual([
      { t: "CARDS_INHERITED", seat: 2, from: 1, handCount: 2, handCardIds: victimHand, inPlay: victimInPlay },
    ]);
    expect(eventsOf(events, "CARD_DISCARDED")).toEqual([]);
    const order = events.map((e) => e.t).filter((t) => ["ELIMINATED", "CARDS_INHERITED", "REWARD"].includes(t));
    expect(order).toEqual(["ELIMINATED", "CARDS_INHERITED", "REWARD"]);
    expect(checkInvariants(state)).toEqual([]);
  });

  it("does not inherit his own cards", () => {
    const s = scenario({ players: [{ hand: ["bang"] }, { role: "outlaw", character: "vulture_sam", life: 1, hand: ["beer"] }, {}, {}] });
    const { events } = run(s, [bang(s, 0, 1), [1, PASS], [1, PASS]]);
    expect(eventsOf(events, "CARDS_INHERITED")).toEqual([]);
    expect(eventsOf(events, "CARD_DISCARDED")[0]).toMatchObject({ seat: 1, reason: "eliminated" });
  });

  it("R-15: a Sheriff Vulture Sam who kills a Deputy takes the cards, then discards everything", () => {
    const s = scenario({
      players: [
        { role: "sheriff", character: "vulture_sam", hand: ["bang", "beer"] },
        { role: "deputy", life: 1, hand: ["missed"] },
        { role: "outlaw" },
        { role: "renegade" },
      ],
    });
    const { state, events } = run(s, [bang(s, 0, 1), [1, PASS], [1, PASS]]);
    expect(eventsOf(events, "CARDS_INHERITED")).toHaveLength(1);
    expect(eventsOf(events, "REWARD")).toEqual([{ t: "REWARD", seat: 0, kind: "deputy_penalty" }]);
    expect(player(state, 0).hand).toEqual([]);
    const penalty = eventsOf(events, "CARD_DISCARDED").find((e) => e.reason === "deputy_penalty");
    expect(penalty?.cardIds).toEqual([firstInHand(s, 0, "beer"), firstInHand(s, 1, "missed")]);
  });
});

describe("T-48 Willy the Kid (R-29)", () => {
  it("can play any number of BANG! cards", () => {
    const s = scenario({ players: [{ character: "willy_the_kid", hand: ["bang", "bang", "bang"] }, {}, {}, {}] });
    const [b1, b2, b3] = handOf(s, 0, "bang") as [CardId, CardId, CardId];
    const { state } = run(s, [
      [0, { type: "PLAY_CARD", cardId: b1, target: { seat: 1 } }],
      [1, PASS],
      [0, { type: "PLAY_CARD", cardId: b2, target: { seat: 1 } }],
      [1, PASS],
    ]);
    expect(state.turn.bangsPlayed).toBe(2);
    expect(getLegalActions(state, 0)).toContainEqual({ type: "PLAY_CARD", cardId: b3, targets: [{ seat: 1 }, { seat: 3 }] });
  });
});
