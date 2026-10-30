export { ALL_CARDS, getCard, isBlueCard, isWeapon } from "@/engine";

/** docs/02 §1.3, written out independently of src/engine/cards/deck.ts. */
export const CARD_TYPES_COUNT_FOR_TEST: Record<string, number> = {
  bang: 25,
  missed: 12,
  beer: 6,
  panic: 4,
  cat_balou: 4,
  stagecoach: 2,
  wells_fargo: 1,
  gatling: 1,
  duel: 3,
  indians: 2,
  general_store: 2,
  saloon: 1,
  barrel: 2,
  scope: 1,
  mustang: 2,
  jail: 3,
  dynamite: 1,
  volcanic: 2,
  schofield: 3,
  remington: 1,
  rev_carabine: 1,
  winchester: 1,
};
