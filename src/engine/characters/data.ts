export const CHARACTER_IDS = [
  "bart_cassidy",
  "black_jack",
  "calamity_janet",
  "el_gringo",
  "jesse_jones",
  "jourdonnais",
  "kit_carlson",
  "lucky_duke",
  "paul_regret",
  "pedro_ramirez",
  "rose_doolan",
  "sid_ketchum",
  "slab_the_killer",
  "suzy_lafayette",
  "vulture_sam",
  "willy_the_kid",
] as const;

export type CharacterId = (typeof CHARACTER_IDS)[number];

export interface CharacterInfo {
  id: CharacterId;
  name: string;
  /** Printed life; the Sheriff gets +1 (docs/02 §2). */
  life: number;
}

// Abilities are implemented in the rules (Phase 4); the character id doubles as the ability id.
export const CHARACTERS: Readonly<Record<CharacterId, CharacterInfo>> = {
  bart_cassidy: { id: "bart_cassidy", name: "Bart Cassidy", life: 4 },
  black_jack: { id: "black_jack", name: "Black Jack", life: 4 },
  calamity_janet: { id: "calamity_janet", name: "Calamity Janet", life: 4 },
  el_gringo: { id: "el_gringo", name: "El Gringo", life: 3 },
  jesse_jones: { id: "jesse_jones", name: "Jesse Jones", life: 4 },
  jourdonnais: { id: "jourdonnais", name: "Jourdonnais", life: 4 },
  kit_carlson: { id: "kit_carlson", name: "Kit Carlson", life: 4 },
  lucky_duke: { id: "lucky_duke", name: "Lucky Duke", life: 4 },
  paul_regret: { id: "paul_regret", name: "Paul Regret", life: 3 },
  pedro_ramirez: { id: "pedro_ramirez", name: "Pedro Ramirez", life: 4 },
  rose_doolan: { id: "rose_doolan", name: "Rose Doolan", life: 4 },
  sid_ketchum: { id: "sid_ketchum", name: "Sid Ketchum", life: 4 },
  slab_the_killer: { id: "slab_the_killer", name: "Slab the Killer", life: 4 },
  suzy_lafayette: { id: "suzy_lafayette", name: "Suzy Lafayette", life: 4 },
  vulture_sam: { id: "vulture_sam", name: "Vulture Sam", life: 4 },
  willy_the_kid: { id: "willy_the_kid", name: "Willy the Kid", life: 4 },
};
