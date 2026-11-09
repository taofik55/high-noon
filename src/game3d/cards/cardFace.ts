import { getCard, isBlueCard, type CardId, type Suit } from "@/engine";
import { CARD_NAMES, SUIT_SYMBOL, cardRules } from "@/ui/cards";

const RANK_LABEL: Record<number, string> = { 11: "J", 12: "Q", 13: "K", 14: "A" };

export interface CardFace {
  title: string;
  /** e.g. "A♠" */
  corner: string;
  red: boolean;
  suit: Suit;
  /** Brown (instant) or blue (in play), like the physical cards. */
  family: "brown" | "blue";
  rules: string;
}

/** What a card face shows; the canvas drawing in cardTexture.ts is a pure function of this. */
export function cardFace(id: CardId): CardFace {
  const card = getCard(id);
  return {
    title: CARD_NAMES[card.type],
    corner: `${RANK_LABEL[card.rank] ?? card.rank}${SUIT_SYMBOL[card.suit]}`,
    red: card.suit === "hearts" || card.suit === "diamonds",
    suit: card.suit,
    family: isBlueCard(card.type) ? "blue" : "brown",
    rules: cardRules(id),
  };
}
