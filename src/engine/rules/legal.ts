import { cardType } from "../cards/deck";
import type { CardId } from "../cards/types";
import type { GameState, Seat } from "../state/types";
import type { Action, Choice, LegalAction, Target } from "./actions";
import { beerAllowed } from "./cards/beer";
import { CARD_HANDLERS } from "./cards";
import { playerAt, topPrompt } from "./context";

/** Seat that must act now (top of the prompt stack), or null when the game is over. */
export function currentActor(s: GameState): Seat | null {
  if (s.winner) return null;
  return topPrompt(s)?.seat ?? null;
}

function handOfType(s: GameState, seat: Seat, type: "missed" | "beer"): CardId[] {
  return playerAt(s, seat).hand.filter((id) => cardType(id) === type);
}

/** Empty if `seat` is not the one to act (docs/03 §2.1). */
export function getLegalActions(s: GameState, seat: Seat): LegalAction[] {
  if (currentActor(s) !== seat) return [];
  const prompt = topPrompt(s);
  if (!prompt) return [];

  switch (prompt.kind) {
    case "CHOOSE_CHARACTER":
      return [{ type: "CHOOSE", choices: prompt.options.map((characterId) => ({ kind: "character", characterId })) }];

    case "PLAY": {
      const legal: LegalAction[] = [];
      for (const cardId of playerAt(s, seat).hand) {
        const handler = CARD_HANDLERS[cardType(cardId)];
        if (!handler) continue;
        const targets = handler.playTargets(s, seat, cardId);
        if (targets === null) legal.push({ type: "PLAY_CARD", cardId, targets: null });
        else if (targets !== false && targets.length > 0) legal.push({ type: "PLAY_CARD", cardId, targets });
      }
      legal.push({ type: "END_TURN" });
      return legal;
    }

    case "RESPOND_BANG": {
      const legal: LegalAction[] = [];
      const missed = handOfType(s, seat, "missed");
      const count = prompt.needed - prompt.got;
      if (count > 0 && missed.length >= count) legal.push({ type: "RESPOND", cardIds: missed, count });
      legal.push({ type: "PASS" });
      return legal;
    }

    case "DYING": {
      const legal: LegalAction[] = [];
      const beers = handOfType(s, seat, "beer");
      if (beers.length > 0 && beerAllowed(s)) legal.push({ type: "RESPOND", cardIds: beers, count: 1 });
      legal.push({ type: "PASS" });
      return legal;
    }

    case "DISCARD_EXCESS":
      return [{ type: "DISCARD", cardIds: [...playerAt(s, seat).hand], count: prompt.count }];
  }
}

function sameTarget(a: Target | undefined, b: Target): boolean {
  return a !== undefined && a.seat === b.seat && a.cardId === b.cardId && a.fromHand === b.fromHand;
}

function sameChoice(a: Choice, b: Choice): boolean {
  return a.kind === b.kind && a.characterId === b.characterId;
}

function checkPick(cardIds: CardId[], allowed: CardId[], count: number): string | null {
  if (cardIds.length !== count) return `must pick exactly ${count} card(s), got ${cardIds.length}`;
  if (new Set(cardIds).size !== cardIds.length) return "duplicate cards";
  const bad = cardIds.find((id) => !allowed.includes(id));
  return bad ? `card ${bad} cannot be used here` : null;
}

/** Returns why `action` is illegal for `seat`, or null if it is legal. */
export function whyIllegal(s: GameState, seat: Seat, action: Action): string | null {
  if (s.winner) return "game is over";
  if (currentActor(s) !== seat) return `seat ${seat} is not the one to act`;
  const legal = getLegalActions(s, seat);

  switch (action.type) {
    case "PLAY_CARD": {
      const option = legal.find((l) => l.type === "PLAY_CARD" && l.cardId === action.cardId);
      if (!option || option.type !== "PLAY_CARD") {
        if (!playerAt(s, seat).hand.includes(action.cardId)) return `card ${action.cardId} is not in hand`;
        return `${cardType(action.cardId)} (${action.cardId}) cannot be played now`;
      }
      if (option.targets === null) return action.target === undefined ? null : "this card takes no target";
      if (action.target === undefined) return "a target is required";
      return option.targets.some((t) => sameTarget(action.target, t)) ? null : "target is not valid (range/rules)";
    }
    case "RESPOND": {
      const option = legal.find((l) => l.type === "RESPOND");
      if (!option || option.type !== "RESPOND") return "no response is possible now";
      return checkPick(action.cardIds, option.cardIds, option.count);
    }
    case "DISCARD": {
      const option = legal.find((l) => l.type === "DISCARD");
      if (!option || option.type !== "DISCARD") return "discarding is not possible now";
      return checkPick(action.cardIds, option.cardIds, option.count);
    }
    case "CHOOSE": {
      const option = legal.find((l) => l.type === "CHOOSE");
      if (!option || option.type !== "CHOOSE") return "there is nothing to choose now";
      return option.choices.some((c) => sameChoice(c, action.choice)) ? null : "choice is not one of the options";
    }
    case "PASS":
    case "END_TURN":
      return legal.some((l) => l.type === action.type) ? null : `${action.type} is not allowed now`;
  }
}

export function isActionLegal(s: GameState, seat: Seat, action: Action): boolean {
  return whyIllegal(s, seat, action) === null;
}

function combinations<T>(items: T[], k: number, limit: number): T[][] {
  const out: T[][] = [];
  const combo: T[] = [];
  const walk = (start: number): void => {
    if (out.length >= limit) return;
    if (combo.length === k) {
      out.push([...combo]);
      return;
    }
    for (let i = start; i <= items.length - (k - combo.length); i++) {
      combo.push(items[i] as T);
      walk(i + 1);
      combo.pop();
    }
  };
  walk(0);
  return out;
}

/**
 * Enumerates concrete actions from descriptors (for bots and random-play tests). Card-pick descriptors are
 * capped at `limitPerDescriptor` combinations, so the result may be a subset when hands are huge.
 */
export function expandLegalActions(legal: LegalAction[], limitPerDescriptor = 200): Action[] {
  const actions: Action[] = [];
  for (const l of legal) {
    switch (l.type) {
      case "PLAY_CARD":
        if (l.targets === null) actions.push({ type: "PLAY_CARD", cardId: l.cardId });
        else for (const target of l.targets) actions.push({ type: "PLAY_CARD", cardId: l.cardId, target });
        break;
      case "RESPOND":
        for (const cardIds of combinations(l.cardIds, l.count, limitPerDescriptor)) actions.push({ type: "RESPOND", cardIds });
        break;
      case "DISCARD":
        for (const cardIds of combinations(l.cardIds, l.count, limitPerDescriptor)) actions.push({ type: "DISCARD", cardIds });
        break;
      case "CHOOSE":
        for (const choice of l.choices) actions.push({ type: "CHOOSE", choice });
        break;
      case "PASS":
      case "END_TURN":
        actions.push({ type: l.type });
        break;
    }
  }
  return actions;
}
