import { CHARACTERS, getCard, type CardId, type CardType, type CharacterId, type Suit } from "@/engine";
import { t, type MessageKey } from "./i18n";

/** Card names stay in English (CLAUDE.md code style). */
export const CARD_NAMES: Record<CardType, string> = {
  bang: "BANG!",
  missed: "Missed!",
  beer: "Beer",
  panic: "Panic!",
  cat_balou: "Cat Balou",
  stagecoach: "Stagecoach",
  wells_fargo: "Wells Fargo",
  gatling: "Gatling",
  duel: "Duel",
  indians: "Indians!",
  general_store: "General Store",
  saloon: "Saloon",
  barrel: "Barrel",
  scope: "Scope",
  mustang: "Mustang",
  jail: "Jail",
  dynamite: "Dynamite",
  volcanic: "Volcanic",
  schofield: "Schofield",
  remington: "Remington",
  rev_carabine: "Rev. Carabine",
  winchester: "Winchester",
};

export const SUIT_SYMBOL: Record<Suit, string> = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };

const RANK_LABEL: Record<number, string> = { 11: "J", 12: "Q", 13: "K", 14: "A" };

export function cardName(id: CardId): string {
  return CARD_NAMES[getCard(id).type];
}

/** "BANG! (A♠)" */
export function cardLabel(id: CardId): string {
  const card = getCard(id);
  return `${CARD_NAMES[card.type]} (${RANK_LABEL[card.rank] ?? card.rank}${SUIT_SYMBOL[card.suit]})`;
}

export function cardRules(id: CardId): string {
  return t(`card.${getCard(id).type}` as MessageKey);
}

const SUIT_COLORS: Record<"classic" | "fourColor", Record<Suit, string>> = {
  classic: { hearts: "#b3261e", diamonds: "#b3261e", clubs: "#1d1a17", spades: "#1d1a17" },
  // Accessibility: red / blue / green / black tell all four suits apart without relying on red vs black.
  fourColor: { hearts: "#b3261e", diamonds: "#1f5fbf", clubs: "#1e7a35", spades: "#1d1a17" },
};

export function suitColor(suit: Suit, fourColor: boolean): string {
  return SUIT_COLORS[fourColor ? "fourColor" : "classic"][suit];
}

export function cardSuit(id: CardId): Suit {
  return getCard(id).suit;
}


export function characterName(id: CharacterId | null): string {
  return id ? CHARACTERS[id].name : "?";
}

export function characterRules(id: CharacterId | null): string {
  return id ? t(`character.${id}` as MessageKey) : "";
}
