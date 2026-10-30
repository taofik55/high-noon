export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

/** 2–10, J=11, Q=12, K=13, A=14 (docs/02 §1.4). */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export const BROWN_CARD_TYPES = [
  "bang",
  "missed",
  "beer",
  "panic",
  "cat_balou",
  "stagecoach",
  "wells_fargo",
  "gatling",
  "duel",
  "indians",
  "general_store",
  "saloon",
] as const;

export const BLUE_CARD_TYPES = [
  "barrel",
  "scope",
  "mustang",
  "jail",
  "dynamite",
  "volcanic",
  "schofield",
  "remington",
  "rev_carabine",
  "winchester",
] as const;

export const CARD_TYPES = [...BROWN_CARD_TYPES, ...BLUE_CARD_TYPES] as const;

export type BrownCardType = (typeof BROWN_CARD_TYPES)[number];
export type BlueCardType = (typeof BLUE_CARD_TYPES)[number];
export type CardType = BrownCardType | BlueCardType;

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
/** Stable card instance id, `c01`…`c80` (CLAUDE.md code style). */
export type CardId = `c${Digit}${Digit}`;

export interface Card {
  id: CardId;
  type: CardType;
  suit: Suit;
  rank: Rank;
}
