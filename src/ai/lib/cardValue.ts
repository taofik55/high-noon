import { WEAPON_RANGE, cardType, weaponRange, type CardId, type PlayerView } from "@/engine";
import { aliveCount, countInHand, hasInPlay, me } from "./view";

/**
 * How useful a card is to keep (docs/06 §2), roughly 0–10. Drives discards, General Store / Kit picks and the
 * "keep defence" heuristics. Depends only on my own view.
 */
export function cardValue(view: PlayerView, cardId: CardId): number {
  const self = me(view);
  const type = cardType(cardId);
  const lowLife = self.life <= 2;
  switch (type) {
    case "missed":
      return lowLife ? 9 : countInHand(view, "missed") > 1 ? 5 : 7;
    case "beer":
      if (aliveCount(view) <= 2) return 1; // R-6: useless with two players left
      return lowLife ? 9 : 6;
    case "bang":
      return countInHand(view, "bang") > 1 ? 4 : 6;
    case "wells_fargo":
      return 8;
    case "stagecoach":
      return 7;
    case "gatling":
      return 7;
    case "indians":
    case "panic":
      return 6;
    case "duel":
    case "cat_balou":
    case "general_store":
      return 5;
    case "saloon":
      return 4;
    case "barrel":
    case "mustang":
    case "scope":
      return hasInPlay(self, type) ? 1 : 7;
    case "jail":
      return 5;
    case "dynamite":
      return 2;
    case "volcanic":
      return countInHand(view, "bang") >= 2 ? 6 : 3;
    case "schofield":
    case "remington":
    case "rev_carabine":
    case "winchester": {
      const gain = (WEAPON_RANGE[type] ?? 1) - weaponRange(self);
      return gain > 0 ? 4 + gain : 1;
    }
  }
}
