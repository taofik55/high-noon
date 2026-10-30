import type { CardType } from "../../cards/types";
import { bangHandler } from "./bang";
import { beerHandler } from "./beer";
import type { CardHandler } from "./handler";

/** Missed! is response-only (T-11), so it has no play-phase handler. */
export const CARD_HANDLERS: Partial<Record<CardType, CardHandler>> = {
  bang: bangHandler,
  beer: beerHandler,
};

export type { CardHandler } from "./handler";
