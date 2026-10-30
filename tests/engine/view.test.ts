import { describe, expect, it } from "vitest";
import {
  applyAction,
  createGame,
  defaultActionOnTimeout,
  getLegalActions,
  isActionLegal,
  redactEvent,
  toPlayerView,
  type GameEvent,
} from "@/engine";
import { eventsOf, firstInHand, player, run, scenario } from "./helpers/scenario";

describe("T-49 toPlayerView", () => {
  const s = scenario({
    players: [
      { role: "sheriff", hand: ["bang", "beer"] },
      { role: "outlaw", hand: ["missed"], inPlay: ["barrel"] },
      { role: "renegade", alive: false },
      { role: "deputy", hand: ["panic", "panic"] },
    ],
  });

  it("shows my hand and role, and only counts / public cards for others", () => {
    const view = toPlayerView(s, 1);
    expect(view.viewer).toBe(1);
    expect(view.myHand).toEqual(player(s, 1).hand);
    expect(view.myRole).toBe("outlaw");
    expect(view.players.map((p) => p.handCount)).toEqual([2, 1, 0, 2]);
    expect(view.players[1]?.inPlay).toEqual(player(s, 1).inPlay);
    expect(view.deckCount).toBe(s.deck.length);
    expect(view.discard).toEqual(s.discard);
  });

  it("reveals only the Sheriff's, my own and dead players' roles", () => {
    expect(toPlayerView(s, 1).players.map((p) => p.role)).toEqual(["sheriff", "outlaw", "renegade", null]);
    expect(toPlayerView(s, 3).players.map((p) => p.role)).toEqual(["sheriff", null, "renegade", "deputy"]);
  });

  it("never contains other hands, the deck order or the RNG state", () => {
    const view = toPlayerView(s, 1);
    const json = JSON.stringify(view);
    for (const seat of [0, 3]) for (const id of player(s, seat).hand) expect(json).not.toContain(`"${id}"`);
    for (const id of s.deck) expect(json).not.toContain(`"${id}"`);
    expect(view).not.toHaveProperty("rng");
    expect(view).not.toHaveProperty("deck");
  });

  it("gives legal actions only to the seat that must act", () => {
    expect(toPlayerView(s, 0).legalActions).toEqual(getLegalActions(s, 0));
    expect(toPlayerView(s, 1).legalActions).toEqual([]);
    expect(toPlayerView(s, 0).currentActor).toBe(0);
  });

  it("spectators see no hand and no hidden role", () => {
    const view = toPlayerView(s, "spectator");
    expect(view.myHand).toEqual([]);
    expect(view.myRole).toBeNull();
    expect(view.players.map((p) => p.role)).toEqual(["sheriff", null, "renegade", null]);
    expect(view.legalActions).toEqual([]);
  });

  it("reveals every role once the game is over", () => {
    const end = scenario({
      players: [{ role: "sheriff", hand: ["bang"] }, { role: "outlaw", life: 1 }, { role: "outlaw", alive: false }, { role: "renegade", alive: false }],
    });
    const { state } = run(end, [
      [0, { type: "PLAY_CARD", cardId: firstInHand(end, 0, "bang"), target: { seat: 1 } }],
      [1, { type: "PASS" }],
      [1, { type: "PASS" }],
    ]);
    expect(toPlayerView(state, 3).players.map((p) => p.role)).toEqual(["sheriff", "outlaw", "outlaw", "renegade"]);
    expect(toPlayerView(state, 3).winner).toBe("sheriff_team");
  });

  it("hides Kit Carlson's cards and other players' character options", () => {
    const kit = scenario({ players: [{}, { character: "kit_carlson" }, {}, {}] });
    const asked = applyAction(kit, 0, { type: "END_TURN" }).state;
    expect(toPlayerView(asked, 1).prompt).toMatchObject({ kind: "KIT_PICK", seat: 1, cards: expect.any(Array) });
    expect(toPlayerView(asked, 0).prompt).toEqual({ kind: "KIT_PICK", seat: 1 });

    const { state } = createGame(
      { players: Array.from({ length: 4 }, (_, i) => ({ name: `P${i}`, isNpc: true })), characterMode: "choose_of_2" },
      "choose-view",
    );
    const chooser = state.stack.at(-1)!;
    const other = (("seat" in chooser ? chooser.seat : 0) + 1) % 4;
    expect(toPlayerView(state, other).prompt).not.toHaveProperty("options");
  });
});

describe("T-50 redactEvent", () => {
  const drawn: GameEvent = { t: "CARDS_DRAWN", seat: 1, count: 2, cardIds: ["c01", "c02"], from: "deck" };

  it("hides drawn card identities from everyone but the drawer", () => {
    expect(redactEvent(drawn, 1)).toEqual(drawn);
    expect(redactEvent(drawn, 0)).toEqual({ t: "CARDS_DRAWN", seat: 1, count: 2, from: "deck" });
    expect(redactEvent(drawn, "spectator")).not.toHaveProperty("cardIds");
    expect(drawn.cardIds).toEqual(["c01", "c02"]); // input untouched
  });

  it("lets Jesse Jones' victim see the card; discard draws are public", () => {
    const jesse: GameEvent = { t: "CARDS_DRAWN", seat: 1, count: 1, cardIds: ["c05"], from: "player", fromSeat: 2 };
    expect(redactEvent(jesse, 2)).toEqual(jesse);
    expect(redactEvent(jesse, 3)).not.toHaveProperty("cardIds");
    const pedro: GameEvent = { t: "CARDS_DRAWN", seat: 1, count: 1, cardIds: ["c05"], from: "discard" };
    expect(redactEvent(pedro, 3)).toEqual(pedro);
  });

  it("hides a card stolen from a hand from bystanders only", () => {
    const stolen: GameEvent = { t: "CARD_STOLEN", from: 1, to: 0, cardId: "c07", fromHand: true };
    expect(redactEvent(stolen, 0)).toEqual(stolen);
    expect(redactEvent(stolen, 1)).toEqual(stolen);
    expect(redactEvent(stolen, 2)).toEqual({ t: "CARD_STOLEN", from: 1, to: 0, fromHand: true });
    const fromPlay: GameEvent = { t: "CARD_STOLEN", from: 1, to: 0, cardId: "c07", fromHand: false };
    expect(redactEvent(fromPlay, 2)).toEqual(fromPlay);
  });

  it("hides roles except your own and the Sheriff's", () => {
    expect(redactEvent({ t: "ROLE_ASSIGNED", seat: 2, role: "outlaw" }, 1)).toBeNull();
    expect(redactEvent({ t: "ROLE_ASSIGNED", seat: 2, role: "outlaw" }, 2)).toEqual({ t: "ROLE_ASSIGNED", seat: 2, role: "outlaw" });
    expect(redactEvent({ t: "ROLE_ASSIGNED", seat: 0, role: "sheriff" }, 1)).toEqual({ t: "ROLE_ASSIGNED", seat: 0, role: "sheriff" });
  });

  it("keeps draw! reveals public, and hides inherited hand cards", () => {
    const check: GameEvent = { t: "DRAW_CHECK", seat: 1, reason: "barrel", cardIds: ["c30"], chosen: "c30", success: false };
    expect(redactEvent(check, 3)).toEqual(check);
    const inherited: GameEvent = { t: "CARDS_INHERITED", seat: 2, from: 1, handCount: 1, handCardIds: ["c09"], inPlay: ["c70"] };
    expect(redactEvent(inherited, 2)).toEqual(inherited);
    expect(redactEvent(inherited, 0)).toEqual({ t: "CARDS_INHERITED", seat: 2, from: 1, handCount: 1, inPlay: ["c70"] });
  });

  it("redacts the events of a real draw for other seats", () => {
    const s = scenario({ players: 4 });
    const { events } = applyAction(s, 0, { type: "END_TURN" });
    const [own] = eventsOf(events, "CARDS_DRAWN");
    expect(own?.cardIds).toHaveLength(2);
    expect(redactEvent(own!, 0)).not.toHaveProperty("cardIds");
  });
});

describe("defaultActionOnTimeout", () => {
  it("ends the turn in the play phase", () => {
    const s = scenario({ players: [{ hand: ["bang"] }, {}, {}, {}] });
    expect(defaultActionOnTimeout(s, 0)).toEqual({ type: "END_TURN" });
  });

  it("defends with Missed! when shot, takes the hit otherwise", () => {
    const s = scenario({ players: [{ hand: ["bang", "bang"] }, { hand: ["missed"] }, {}, {}] });
    const shot = applyAction(s, 0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "bang"), target: { seat: 1 } }).state;
    expect(defaultActionOnTimeout(shot, 1)).toEqual({ type: "RESPOND", cardIds: [firstInHand(s, 1, "missed")] });
    const none = scenario({ players: [{ hand: ["bang"] }, {}, {}, {}] });
    const shot2 = applyAction(none, 0, { type: "PLAY_CARD", cardId: firstInHand(none, 0, "bang"), target: { seat: 1 } }).state;
    expect(defaultActionOnTimeout(shot2, 1)).toEqual({ type: "PASS" });
  });

  it("drinks a Beer when dying, gives up a Duel, discards the last cards", () => {
    const s = scenario({ players: [{ hand: ["bang"] }, { life: 1, hand: ["beer"] }, {}, {}] });
    const dying = run(s, [
      [0, { type: "PLAY_CARD", cardId: firstInHand(s, 0, "bang"), target: { seat: 1 } }],
      [1, { type: "PASS" }],
    ]).state;
    expect(defaultActionOnTimeout(dying, 1)).toEqual({ type: "RESPOND", cardIds: [firstInHand(s, 1, "beer")] });

    const d = scenario({ players: [{ hand: ["duel"] }, { hand: ["bang"] }, {}, {}] });
    const duel = applyAction(d, 0, { type: "PLAY_CARD", cardId: firstInHand(d, 0, "duel"), target: { seat: 1 } }).state;
    expect(defaultActionOnTimeout(duel, 1)).toEqual({ type: "PASS" });

    const x = scenario({ players: [{ life: 1, hand: ["bang", "missed", "beer"] }, {}, {}, {}] });
    const excess = applyAction(x, 0, { type: "END_TURN" }).state;
    const action = defaultActionOnTimeout(excess, 0);
    expect(action).toEqual({ type: "DISCARD", cardIds: player(x, 0).hand.slice(1) });
    expect(isActionLegal(excess, 0, action)).toBe(true);
  });

  it("throws for a seat that has nothing to do", () => {
    const s = scenario({ players: 4 });
    expect(() => defaultActionOnTimeout(s, 2)).toThrow();
  });
});
