import type { CharacterId } from "@/engine";

/** Rough strength ranking for the choose_of_2 variant (higher first). Community consensus, not exact science. */
const RANK: readonly CharacterId[] = [
  "slab_the_killer",
  "willy_the_kid",
  "jourdonnais",
  "sid_ketchum",
  "calamity_janet",
  "paul_regret",
  "black_jack",
  "kit_carlson",
  "bart_cassidy",
  "lucky_duke",
  "rose_doolan",
  "el_gringo",
  "jesse_jones",
  "suzy_lafayette",
  "vulture_sam",
  "pedro_ramirez",
];

export function characterStrength(id: CharacterId): number {
  return RANK.length - RANK.indexOf(id);
}
