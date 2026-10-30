import type { CardType } from "../../cards/types";
import { bangHandler } from "./bang";
import { beerHandler } from "./beer";
import { generalStoreHandler } from "./generalStore";
import type { CardHandler } from "./handler";
import { duelHandler, gatlingHandler, indiansHandler } from "./multi";
import { saloonHandler, stagecoachHandler, wellsFargoHandler } from "./simple";
import { catBalouHandler, panicHandler } from "./takeCard";

/** Missed! is response-only (T-11), so it has no play-phase handler. */
export const CARD_HANDLERS: Partial<Record<CardType, CardHandler>> = {
  bang: bangHandler,
  beer: beerHandler,
  panic: panicHandler,
  cat_balou: catBalouHandler,
  stagecoach: stagecoachHandler,
  wells_fargo: wellsFargoHandler,
  gatling: gatlingHandler,
  indians: indiansHandler,
  duel: duelHandler,
  general_store: generalStoreHandler,
  saloon: saloonHandler,
};

export type { CardHandler } from "./handler";
