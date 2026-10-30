import type { Action, LegalAction } from "../rules/actions";
import { topPrompt } from "../rules/context";
import { getLegalActions } from "../rules/legal";
import type { GameState, PromptKind, Seat } from "../state/types";

/**
 * The action taken for a player whose timer ran out (docs/03 §5.2). It defends automatically so an AFK player does not
 * die for nothing: Missed! when shot, BANG! against Indians!, Beer when dying; otherwise the most passive option
 * (end the turn, give up the Duel, first offered choice, discard the most recently drawn cards). Always legal.
 */
export function defaultActionOnTimeout(s: GameState, seat: Seat): Action {
  const prompt = topPrompt(s);
  if (!prompt) throw new Error(`defaultActionOnTimeout: seat ${seat} has nothing to do`);
  return defaultActionFromLegal(prompt.kind, getLegalActions(s, seat));
}

/**
 * Same policy from a prompt kind and legal-action descriptors only, so the AI can fall back on it from its
 * PlayerView without the game state.
 */
export function defaultActionFromLegal(kind: PromptKind, legal: readonly LegalAction[]): Action {
  if (legal.length === 0) throw new Error("defaultActionFromLegal: no legal action");
  switch (kind) {
    case "PLAY":
      return { type: "END_TURN" };
    case "RESPOND_BANG":
    case "RESPOND_INDIANS":
    case "DYING": {
      const respond = legal.find((l) => l.type === "RESPOND");
      if (respond?.type === "RESPOND") return { type: "RESPOND", cardIds: respond.cardIds.slice(0, respond.count) };
      return { type: "PASS" };
    }
    case "DUEL":
      return { type: "PASS" };
    case "DISCARD_EXCESS": {
      const discard = legal.find((l) => l.type === "DISCARD");
      if (discard?.type !== "DISCARD") break;
      return { type: "DISCARD", cardIds: discard.cardIds.slice(discard.cardIds.length - discard.count) };
    }
    case "CHOOSE_CHARACTER":
    case "STORE_PICK":
    case "DRAW_CHOICE":
    case "KIT_PICK": {
      const choose = legal.find((l) => l.type === "CHOOSE");
      const choice = choose?.type === "CHOOSE" ? choose.choices[0] : undefined;
      if (choice) return { type: "CHOOSE", choice };
      break;
    }
    case "MULTI_TARGET":
      break;
  }
  throw new Error(`defaultActionFromLegal: no default for ${kind}`);
}
