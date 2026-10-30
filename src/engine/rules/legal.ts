import { cardType } from "../cards/deck";
import type { CardId, CardType } from "../cards/types";
import { promptActor, type GameState, type Prompt, type Seat } from "../state/types";
import type { Action, Choice, LegalAction, Target } from "./actions";
import { bangTargets } from "./cards/bang";
import { beerAllowed } from "./cards/beer";
import { CARD_HANDLERS } from "./cards";
import { hasAbility, playerAt, topPrompt } from "./context";
import { drawChoices } from "./drawPhase";

/** Seat that must act now (top of the prompt stack), or null when the game is over. */
export function currentActor(s: GameState): Seat | null {
  if (s.winner) return null;
  const top = topPrompt(s);
  return top ? promptActor(top) : null;
}

function handOfType(s: GameState, seat: Seat, ...types: CardType[]): CardId[] {
  const hand = playerAt(s, seat).hand;
  // Ordered by `types` so the "natural" card comes first (Missed! before a Calamity BANG!), which keeps
  // defaultActionOnTimeout sensible.
  return types.flatMap((type) => hand.filter((id) => cardType(id) === type));
}

/** Cards that cancel a BANG!: Missed!, plus BANG! for Calamity Janet (R-19). */
function missedCards(s: GameState, seat: Seat): CardId[] {
  return hasAbility(playerAt(s, seat), "calamity_janet") ? handOfType(s, seat, "missed", "bang") : handOfType(s, seat, "missed");
}

/** Cards discarded against Indians! and in a Duel: BANG!, plus Missed! for Calamity Janet (§6.3, §6.4). */
function bangCards(s: GameState, seat: Seat): CardId[] {
  return hasAbility(playerAt(s, seat), "calamity_janet") ? handOfType(s, seat, "bang", "missed") : handOfType(s, seat, "bang");
}

/** Prompts during which Sid Ketchum may use his ability (R-25: any time he is the one to act, dying included). */
const SID_PROMPTS = new Set<Prompt["kind"]>(["PLAY", "RESPOND_BANG", "RESPOND_INDIANS", "DUEL", "DYING", "DISCARD_EXCESS"]);

function sidKetchum(s: GameState, seat: Seat, prompt: Prompt): LegalAction[] {
  const p = playerAt(s, seat);
  // Like Beer at full life (R-7), healing nothing is not offered.
  if (!hasAbility(p, "sid_ketchum") || !SID_PROMPTS.has(prompt.kind) || p.hand.length < 2 || p.life >= p.maxLife) return [];
  return [{ type: "ABILITY", ability: "sid_ketchum", cardIds: [...p.hand], count: 2 }];
}

function promptActions(s: GameState, seat: Seat, prompt: Prompt): LegalAction[] {
  switch (prompt.kind) {
    case "CHOOSE_CHARACTER":
      return [{ type: "CHOOSE", choices: prompt.options.map((characterId) => ({ kind: "character", characterId })) }];

    case "PLAY": {
      const legal: LegalAction[] = [];
      const calamity = hasAbility(playerAt(s, seat), "calamity_janet");
      for (const cardId of playerAt(s, seat).hand) {
        const type = cardType(cardId);
        const handler = CARD_HANDLERS[type];
        if (handler) {
          const targets = handler.playTargets(s, seat, cardId);
          if (targets === null) legal.push({ type: "PLAY_CARD", cardId, targets: null });
          else if (targets !== false && targets.length > 0) legal.push({ type: "PLAY_CARD", cardId, targets });
        }
        if (calamity && type === "missed") {
          const targets = bangTargets(s, seat);
          if (targets !== false && targets.length > 0) legal.push({ type: "PLAY_CARD", cardId, asType: "bang", targets });
        }
      }
      legal.push({ type: "END_TURN" });
      return legal;
    }

    case "RESPOND_BANG": {
      const legal: LegalAction[] = [];
      const cards = missedCards(s, seat);
      const count = prompt.needed - prompt.got;
      if (count > 0 && cards.length >= count) legal.push({ type: "RESPOND", cardIds: cards, count });
      legal.push({ type: "PASS" });
      return legal;
    }

    // Indians!: discard a BANG! or take the hit; Missed!/Barrel do not help (§6.3). Duel: same choice each round.
    case "RESPOND_INDIANS":
    case "DUEL": {
      const legal: LegalAction[] = [];
      const cards = bangCards(s, seat);
      if (cards.length > 0) legal.push({ type: "RESPOND", cardIds: cards, count: 1 });
      legal.push({ type: "PASS" });
      return legal;
    }

    case "STORE_PICK":
      return [{ type: "CHOOSE", choices: prompt.revealed.map((cardId) => ({ kind: "store_card", cardId })) }];

    case "DRAW_CHOICE":
      return [{ type: "CHOOSE", choices: drawChoices(s, seat) }];

    case "KIT_PICK":
      return [{ type: "CHOOSE", choices: prompt.cards.map((cardId) => ({ kind: "kit_return", cardId })) }];

    case "DYING": {
      const legal: LegalAction[] = [];
      const beers = handOfType(s, seat, "beer");
      if (beers.length > 0 && beerAllowed(s)) legal.push({ type: "RESPOND", cardIds: beers, count: 1 });
      legal.push({ type: "PASS" });
      return legal;
    }

    case "DISCARD_EXCESS":
      return [{ type: "DISCARD", cardIds: [...playerAt(s, seat).hand], count: prompt.count }];

    case "MULTI_TARGET":
      return [];
  }
}

/** Empty if `seat` is not the one to act (docs/03 §2.1). */
export function getLegalActions(s: GameState, seat: Seat): LegalAction[] {
  if (currentActor(s) !== seat) return [];
  const prompt = topPrompt(s);
  if (!prompt) return [];
  return [...promptActions(s, seat, prompt), ...sidKetchum(s, seat, prompt)];
}

function sameTarget(a: Target | undefined, b: Target): boolean {
  return a !== undefined && a.seat === b.seat && a.cardId === b.cardId && a.fromHand === b.fromHand;
}

function sameChoice(a: Choice, b: Choice): boolean {
  switch (a.kind) {
    case "character":
      return b.kind === "character" && a.characterId === b.characterId;
    case "store_card":
      return b.kind === "store_card" && a.cardId === b.cardId;
    case "kit_return":
      return b.kind === "kit_return" && a.cardId === b.cardId;
    case "draw":
      return b.kind === "draw" && a.from === b.from && a.seat === b.seat;
  }
}

function checkPick(cardIds: readonly CardId[], allowed: readonly CardId[], count: number): string | null {
  if (cardIds.length !== count) return `must pick exactly ${count} card(s), got ${cardIds.length}`;
  if (new Set(cardIds).size !== cardIds.length) return "duplicate cards";
  const bad = cardIds.find((id) => !allowed.includes(id));
  return bad ? `card ${bad} cannot be used here` : null;
}

/** Returns why `action` is illegal for `seat`, or null if it is legal. */
export function whyIllegal(s: GameState, seat: Seat, action: Action): string | null {
  if (s.winner) return "game is over";
  if (currentActor(s) !== seat) return `seat ${seat} is not the one to act`;
  return matchLegal(getLegalActions(s, seat), action, playerAt(s, seat).hand);
}

/**
 * Checks `action` against legal-action descriptors only (no state needed), so the AI can validate its choice against
 * `view.legalActions`. `hand` only sharpens the error message. Returns null if the action is allowed.
 */
export function matchLegal(legal: readonly LegalAction[], action: Action, hand?: readonly CardId[]): string | null {
  switch (action.type) {
    case "PLAY_CARD": {
      const option = legal.find((l) => l.type === "PLAY_CARD" && l.cardId === action.cardId && l.asType === action.asType);
      if (!option || option.type !== "PLAY_CARD") {
        if (hand && !hand.includes(action.cardId)) return `card ${action.cardId} is not in hand`;
        const as = action.asType ? ` as ${action.asType}` : "";
        return `${cardType(action.cardId)} (${action.cardId})${as} cannot be played now`;
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
    case "ABILITY": {
      const option = legal.find((l) => l.type === "ABILITY" && l.ability === action.ability);
      if (!option || option.type !== "ABILITY") return `${action.ability} ability cannot be used now`;
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
export function expandLegalActions(legal: readonly LegalAction[], limitPerDescriptor = 200): Action[] {
  const actions: Action[] = [];
  for (const l of legal) {
    switch (l.type) {
      case "PLAY_CARD": {
        const as = l.asType ? { asType: l.asType } : {};
        if (l.targets === null) actions.push({ type: "PLAY_CARD", cardId: l.cardId, ...as });
        else for (const target of l.targets) actions.push({ type: "PLAY_CARD", cardId: l.cardId, ...as, target });
        break;
      }
      case "RESPOND":
        for (const cardIds of combinations(l.cardIds, l.count, limitPerDescriptor)) actions.push({ type: "RESPOND", cardIds });
        break;
      case "DISCARD":
        for (const cardIds of combinations(l.cardIds, l.count, limitPerDescriptor)) actions.push({ type: "DISCARD", cardIds });
        break;
      case "ABILITY":
        for (const cardIds of combinations(l.cardIds, l.count, limitPerDescriptor)) {
          actions.push({ type: "ABILITY", ability: l.ability, cardIds });
        }
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
