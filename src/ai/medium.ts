import {
  WEAPON_RANGE,
  cardType,
  effectiveDistance,
  expandLegalActions,
  randomInt,
  weaponRange,
  type Action,
  type CardId,
  type CardType,
  type Choice,
  type LegalAction,
  type PlayerView,
  type RngState,
} from "@/engine";
import { cardValue } from "./lib/cardValue";
import { characterStrength } from "./lib/characters";
import { hostility, isEnemy } from "./lib/hostility";
import { byValue, countInHand, me, mySeat, playerOf } from "./lib/view";
import type { AiMemory } from "./types";

export interface ScoredAction {
  action: Action;
  score: number;
}

const END_TURN: Action = { type: "END_TURN" };
const PASS: Action = { type: "PASS" };

/** What an in-play card is worth taking or destroying. */
function inPlayWorth(type: CardType): number {
  if (WEAPON_RANGE[type] !== undefined) return 2;
  if (type === "barrel") return 3;
  if (type === "mustang") return 2;
  if (type === "scope") return 1;
  return 0;
}

function enemiesInRange(view: PlayerView, memory: AiMemory, range: number): number {
  const seat = mySeat(view);
  return view.players.filter((p) => p.alive && p.seat !== seat && isEnemy(view, memory, p.seat) && effectiveDistance(view, seat, p.seat) <= range).length;
}

/**
 * Heuristic value of one play-phase action (docs/06 §4 priority list: survive, gain cards, equip, attack). END_TURN is
 * worth 0, so anything scoring ≤ 0 is not worth playing now (the card is kept for later or for defence).
 */
export function scorePlay(view: PlayerView, memory: AiMemory, action: Action): number {
  const self = me(view);
  if (action.type === "END_TURN") return 0;
  if (action.type === "ABILITY") return self.life <= 2 && view.myHand.length >= 4 ? 3 : -1;
  if (action.type !== "PLAY_CARD") return -10;

  const type = action.asType ?? cardType(action.cardId);
  const targetSeat = action.target?.seat;
  const h = targetSeat === undefined ? 0 : hostility(view, memory, targetSeat);
  const target = targetSeat === undefined ? undefined : playerOf(view, targetSeat);

  switch (type) {
    case "beer":
      return self.life <= 2 ? 8 : self.maxLife - self.life >= 2 ? 2.5 : -0.5;
    case "wells_fargo":
      return 10;
    case "stagecoach":
      return 9;
    case "general_store":
      return 4;
    case "saloon": {
      let s = 0.5;
      for (const p of view.players) {
        if (p.alive && p.life < p.maxLife) s += hostility(view, memory, p.seat) > 0 ? -1 : 1;
      }
      return s;
    }
    case "barrel":
    case "mustang":
    case "scope":
      return 7;
    case "volcanic": {
      const bangs = countInHand(view, "bang");
      return bangs >= 2 && weaponRange(self) <= 1 ? 6 : bangs >= 3 ? 4 : -1;
    }
    case "schofield":
    case "remington":
    case "rev_carabine":
    case "winchester": {
      const range = WEAPON_RANGE[type] ?? 1;
      const gain = range - weaponRange(self);
      if (gain <= 0) return -1;
      const newly = enemiesInRange(view, memory, range) - enemiesInRange(view, memory, weaponRange(self));
      return 3 + gain * 0.5 + newly * 2;
    }
    case "dynamite":
      return view.myHand.length >= 6 ? 0.5 : -1;
    case "jail":
      return h > 0.2 ? 4 + 3 * h : -3;
    case "bang": {
      if (h <= 0.15) return -4;
      let s = 5 + 3 * h;
      if (target && target.life <= 1) s += 4;
      if (action.asType) s -= 1; // Calamity: spending a Missed! costs defence
      return s;
    }
    case "duel": {
      if (h <= 0.15 || !target) return -3;
      const mine = countInHand(view, "bang");
      return mine >= target.handCount * 0.3 + 1 ? 4 + 2 * h : -1;
    }
    case "gatling":
    case "indians": {
      let s = 0;
      for (const p of view.players) if (p.alive && p.seat !== self.seat) s += hostility(view, memory, p.seat);
      return s > 0.3 ? 4 + 2 * s : -2;
    }
    case "panic":
    case "cat_balou": {
      const bonus = type === "panic" ? 1 : 0;
      const taken = action.target?.cardId;
      if (taken) {
        const takenType = cardType(taken);
        // Jail / Dynamite: worth removing from an ally, never from an enemy.
        if (takenType === "jail" || takenType === "dynamite") return h < 0 ? 6 : -2;
        return h > 0.15 ? 4 + 2 * h + bonus + inPlayWorth(takenType) : -4;
      }
      return h > 0.15 ? 3 + 2 * h + bonus : -3;
    }
    case "missed":
      return -10;
  }
}

/** All concrete play actions, best first. */
export function rankPlayActions(view: PlayerView, memory: AiMemory): ScoredAction[] {
  return expandLegalActions(view.legalActions, 30)
    .map((action) => ({ action, score: scorePlay(view, memory, action) }))
    .sort((a, b) => b.score - a.score);
}

function pickBest(ranked: ScoredAction[], rng: RngState): Action {
  const top = ranked[0];
  if (!top) return END_TURN;
  const ties = ranked.filter((r) => r.score === top.score);
  return (ties[randomInt(rng, ties.length)] ?? top).action;
}

function respondOption(legal: readonly LegalAction[]): Extract<LegalAction, { type: "RESPOND" }> | undefined {
  const r = legal.find((l) => l.type === "RESPOND");
  return r?.type === "RESPOND" ? r : undefined;
}

function abilityOption(legal: readonly LegalAction[]): Extract<LegalAction, { type: "ABILITY" }> | undefined {
  const a = legal.find((l) => l.type === "ABILITY");
  return a?.type === "ABILITY" ? a : undefined;
}

/** Sid Ketchum: discard the 2 least valuable cards. */
function sidAction(view: PlayerView, option: Extract<LegalAction, { type: "ABILITY" }>): Action {
  return { type: "ABILITY", ability: option.ability, cardIds: byValue(option.cardIds, (id) => cardValue(view, id)).slice(0, option.count) };
}

function choices(legal: readonly LegalAction[]): Choice[] {
  const c = legal.find((l) => l.type === "CHOOSE");
  return c?.type === "CHOOSE" ? c.choices : [];
}

function bestChoice(options: Choice[], score: (c: Choice) => number): Action {
  let best = options[0];
  let bestScore = -Infinity;
  for (const c of options) {
    const s = score(c);
    if (s > bestScore) {
      best = c;
      bestScore = s;
    }
  }
  if (!best) throw new Error("bestChoice: nothing to choose");
  return { type: "CHOOSE", choice: best };
}

export function decideMedium(view: PlayerView, memory: AiMemory, rng: RngState): Action {
  const prompt = view.prompt;
  const legal = view.legalActions;
  if (!prompt) throw new Error("decideMedium: no prompt");
  const value = (id: CardId): number => cardValue(view, id);

  switch (prompt.kind) {
    case "PLAY":
      return pickBest(rankPlayActions(view, memory), rng);

    case "RESPOND_BANG":
    case "RESPOND_INDIANS": {
      // Losing a life is worth more than any single card: always defend (docs/06 "use Missed!/Barrel automatically").
      const r = respondOption(legal);
      return r ? { type: "RESPOND", cardIds: r.cardIds.slice(0, r.count) } : PASS;
    }

    case "DUEL": {
      // Keep fighting enemies, or when a lost life would be fatal; let a friendly duel go.
      const r = respondOption(legal);
      const fight = hostility(view, memory, prompt.opponent) > 0 || me(view).life <= 1;
      return r && fight ? { type: "RESPOND", cardIds: r.cardIds.slice(0, r.count) } : PASS;
    }

    case "DYING": {
      const r = respondOption(legal);
      if (r) return { type: "RESPOND", cardIds: r.cardIds.slice(0, r.count) };
      const sid = abilityOption(legal);
      return sid ? sidAction(view, sid) : PASS;
    }

    case "DISCARD_EXCESS": {
      // Sid Ketchum turns two cards he must lose anyway into a life point.
      const sid = abilityOption(legal);
      if (sid && prompt.count >= 2) return sidAction(view, sid);
      const d = legal.find((l) => l.type === "DISCARD");
      if (d?.type !== "DISCARD") break;
      return { type: "DISCARD", cardIds: byValue(d.cardIds, value).slice(0, d.count) };
    }

    case "STORE_PICK":
      return bestChoice(choices(legal), (c) => (c.kind === "store_card" ? value(c.cardId) : -1));

    case "KIT_PICK":
      // Return the least useful card to the deck.
      return bestChoice(choices(legal), (c) => (c.kind === "kit_return" ? -value(c.cardId) : -99));

    case "DRAW_CHOICE":
      return bestChoice(choices(legal), (c) => {
        if (c.kind !== "draw") return -99;
        if (c.from === "deck") return 0;
        if (c.from === "discard") {
          const top = view.discard.at(-1);
          return top !== undefined && value(top) >= 6 ? 1 : -1;
        }
        // Jesse Jones: rob the enemy with the most cards.
        if (c.seat === undefined || !isEnemy(view, memory, c.seat)) return -1;
        return 0.5 + playerOf(view, c.seat).handCount * 0.1;
      });

    case "CHOOSE_CHARACTER":
      return bestChoice(choices(legal), (c) => (c.kind === "character" ? characterStrength(c.characterId) : -1));

    case "MULTI_TARGET":
      break;
  }
  const [first] = expandLegalActions(legal, 1);
  if (!first) throw new Error(`decideMedium: no legal action for ${prompt.kind}`);
  return first;
}
