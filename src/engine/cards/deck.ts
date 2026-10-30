import type { Card, CardId, CardType, Rank, Suit } from "./types";

// TODO(verify): suits/ranks vs physical deck (Ruling R-1). This follows the official base-game card list as best
// known (exactly 20 cards per suit); the owner verifies it against the physical deck. Tests never rely on these
// printed values: they build decks explicitly with the scenario builder.

const J = 11;
const Q = 12;
const K = 13;
const A = 14;

type Entry = readonly [Suit, Rank];

const h = (...ranks: Rank[]): Entry[] => ranks.map((r) => ["hearts", r] as const);
const d = (...ranks: Rank[]): Entry[] => ranks.map((r) => ["diamonds", r] as const);
const c = (...ranks: Rank[]): Entry[] => ranks.map((r) => ["clubs", r] as const);
const s = (...ranks: Rank[]): Entry[] => ranks.map((r) => ["spades", r] as const);

const DECK_LIST: ReadonlyArray<readonly [CardType, Entry[]]> = [
  ["bang", [...s(A), ...d(2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A), ...c(2, 3, 4, 5, 6, 7, 8, 9), ...h(Q, K, A)]],
  ["missed", [...c(10, J, Q, K, A), ...s(2, 3, 4, 5, 6, 7, 8)]],
  ["beer", h(6, 7, 8, 9, 10, J)],
  ["panic", [...h(J, Q, A), ...d(8)]],
  ["cat_balou", [...h(K), ...d(9, 10, J)]],
  ["stagecoach", s(9, 9)],
  ["wells_fargo", h(3)],
  ["gatling", h(10)],
  ["duel", [...d(Q), ...s(J), ...c(8)]],
  ["indians", d(K, A)],
  ["general_store", [...c(9), ...s(Q)]],
  ["saloon", h(5)],
  ["barrel", s(Q, K)],
  ["scope", s(A)],
  ["mustang", h(8, 9)],
  ["jail", [...s(10, J), ...h(4)]],
  ["dynamite", h(2)],
  ["volcanic", [...s(10), ...c(10)]],
  ["schofield", [...c(J, Q), ...s(K)]],
  ["remington", c(K)],
  ["rev_carabine", c(A)],
  ["winchester", s(8)],
];

function buildDeck(): Card[] {
  const cards: Card[] = [];
  for (const [type, entries] of DECK_LIST) {
    for (const [suit, rank] of entries) {
      const id = `c${String(cards.length + 1).padStart(2, "0")}` as CardId;
      cards.push({ id, type, suit, rank });
    }
  }
  return cards;
}

/** All 80 cards in id order. Static data: game state stores only ids. */
export const ALL_CARDS: readonly Card[] = Object.freeze(buildDeck().map((card) => Object.freeze(card)));

export const ALL_CARD_IDS: readonly CardId[] = Object.freeze(ALL_CARDS.map((card) => card.id));

const CARD_BY_ID = new Map<CardId, Card>(ALL_CARDS.map((card) => [card.id, card]));

export function getCard(id: CardId): Card {
  const card = CARD_BY_ID.get(id);
  if (!card) throw new Error(`Unknown card id ${id}`);
  return card;
}

export function cardType(id: CardId): CardType {
  return getCard(id).type;
}

export function isCardId(value: unknown): value is CardId {
  return typeof value === "string" && CARD_BY_ID.has(value as CardId);
}
