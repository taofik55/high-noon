import { isWeapon } from "../../cards/cardData";
import { cardType } from "../../cards/deck";
import type { CardId } from "../../cards/types";
import { emit, hasCardType, livingSeats, playerAt, removeFromPlay } from "../context";
import type { CardHandler } from "./handler";

/**
 * Blue cards placed in front of yourself: weapons, Barrel, Scope, Mustang, Dynamite.
 * No two blue cards with the same name in front of one player (§4.3), which also forbids re-playing the weapon
 * you already hold (R-32). A different weapon replaces the old one, which is discarded (T-21).
 */
export const equipHandler: CardHandler = {
  playTargets(s, seat, cardId) {
    return hasCardType(playerAt(s, seat), cardType(cardId)) ? false : null;
  },

  play(ctx, seat, cardId) {
    const p = playerAt(ctx.s, seat);
    let replaced: CardId | undefined;
    if (isWeapon(cardType(cardId))) {
      replaced = p.inPlay.find((id) => isWeapon(cardType(id)));
      if (replaced) {
        removeFromPlay(p, replaced);
        ctx.s.discard.push(replaced);
      }
    }
    p.inPlay.push(cardId);
    emit(ctx, { t: "EQUIPPED", seat, cardId, ...(replaced ? { replaced } : {}) });
  },
};

/** Jail: on another living player, never the Sheriff, never someone already in Jail (§4.3). */
export const jailHandler: CardHandler = {
  playTargets(s, seat) {
    return livingSeats(s)
      .filter((to) => {
        const target = playerAt(s, to);
        return to !== seat && target.role !== "sheriff" && !hasCardType(target, "jail");
      })
      .map((to) => ({ seat: to }));
  },

  play(ctx, seat, cardId, target) {
    const to = target?.seat;
    if (to === undefined) throw new Error("Jail needs a target seat");
    playerAt(ctx.s, to).inPlay.push(cardId);
    emit(ctx, { t: "JAILED", seat: to, by: seat });
  },
};
