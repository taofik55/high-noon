import {
  cardType,
  expandLegalActions,
  pick,
  randomInt,
  type Action,
  type CardId,
  type LegalAction,
  type PlayerView,
  type RngState,
} from "@/engine";
import { aliveCount, me, playerOf } from "./lib/view";

const END_TURN: Action = { type: "END_TURN" };

/** Whether an easy bot may attack the Sheriff: Outlaws always, the Renegade only in the final duel, Deputies never. */
function mayAttackSheriff(view: PlayerView): boolean {
  if (view.myRole === "outlaw") return true;
  return view.myRole === "renegade" && aliveCount(view) <= 2;
}

/**
 * A "non-wasteful" play for an easy bot (docs/06 §4): Beer only when about to die, and the Sheriff-team bias of
 * mayAttackSheriff. Everything else goes.
 */
function sensible(view: PlayerView, action: Action): boolean {
  if (action.type === "ABILITY") return me(view).life <= 1;
  if (action.type !== "PLAY_CARD") return false;
  const type = action.asType ?? cardType(action.cardId);
  if (type === "beer") return me(view).life <= 1;
  const target = action.target?.seat;
  if (target !== undefined && playerOf(view, target).role === "sheriff" && !mayAttackSheriff(view)) return false;
  return true;
}

function respond(legal: readonly LegalAction[]): Action | undefined {
  const r = legal.find((l) => l.type === "RESPOND");
  return r?.type === "RESPOND" ? { type: "RESPOND", cardIds: r.cardIds.slice(0, r.count) } : undefined;
}

export function decideEasy(view: PlayerView, rng: RngState): Action {
  const prompt = view.prompt;
  const legal = view.legalActions;
  if (!prompt) throw new Error("decideEasy: no prompt");

  switch (prompt.kind) {
    case "PLAY": {
      const options = expandLegalActions(legal, 10).filter((a) => sensible(view, a));
      // Plays a random sensible card ~60% of the time, otherwise ends the turn.
      if (options.length === 0 || randomInt(rng, 10) >= 6) return END_TURN;
      return pick(rng, options);
    }
    // Always defends when it can.
    case "RESPOND_BANG":
    case "RESPOND_INDIANS":
    case "DUEL":
    case "DYING":
      return respond(legal) ?? { type: "PASS" };
    case "DISCARD_EXCESS": {
      const d = legal.find((l) => l.type === "DISCARD");
      if (d?.type !== "DISCARD") break;
      const pool = [...d.cardIds];
      const cardIds: CardId[] = [];
      for (let i = 0; i < d.count; i++) cardIds.push(pool.splice(randomInt(rng, pool.length), 1)[0]!);
      return { type: "DISCARD", cardIds };
    }
    default:
      break;
  }
  return pick(rng, expandLegalActions(legal, 10));
}
