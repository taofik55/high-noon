import { BLUE_CARD_TYPES, type CardType } from "./types";

/** Default weapon when no weapon card is in play: Colt .45 (docs/02 §1.3). */
export const COLT_45_RANGE = 1;

export const WEAPON_RANGE: Partial<Record<CardType, number>> = {
  volcanic: 1,
  schofield: 2,
  remington: 3,
  rev_carabine: 4,
  winchester: 5,
};

const BLUE = new Set<CardType>(BLUE_CARD_TYPES);

export function isBlueCard(type: CardType): boolean {
  return BLUE.has(type);
}

export function isWeapon(type: CardType): boolean {
  return WEAPON_RANGE[type] !== undefined;
}
