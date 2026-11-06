import type { CharacterId } from "@/engine";
import { DEFAULT_SPEC, type CharacterSpec } from "./spec";

// The 16 characters (docs/07 §2.1 visual ideas) as variations of the master cowboy on the shared skeleton.

type Overrides = Omit<Partial<CharacterSpec>, "palette" | "face" | "hat"> & {
  palette?: Partial<CharacterSpec["palette"]>;
  face?: Partial<CharacterSpec["face"]>;
  hat?: Partial<CharacterSpec["hat"]>;
};

const variant = (o: Overrides): CharacterSpec => ({
  ...DEFAULT_SPEC,
  ...o,
  palette: { ...DEFAULT_SPEC.palette, ...o.palette },
  face: { ...DEFAULT_SPEC.face, ...o.face },
  hat: { ...DEFAULT_SPEC.hat, ...o.hat },
  signature: o.signature ?? [],
});

const WOMAN = { body: "female", face: { jaw: 0.82, nose: 0.82, mustache: "none", stubble: 0, brow: 0.003 } } as const;

export const ROSTER: Readonly<Record<CharacterId, CharacterSpec>> = {
  // Young ranch hand: rolled sleeves, playing cards in the vest pocket.
  bart_cassidy: variant({
    coat: "none",
    palette: { shirt: "#8fa3b8", vest: "#5a3a26", trousers: "#3e4f66", hat: "#a07a50", hair: "#7a5432", neckerchief: "#b04030" },
    face: { mustache: "none", stubble: 0.2, squint: 0.3 },
    signature: ["cards"],
  }),
  // Gambler: black suit, flat-crowned hat, card suits embroidered on the vest.
  black_jack: variant({
    coat: "suit",
    palette: { coat: "#1e1d1f", vest: "#3a2440", shirt: "#e8e2d4", trousers: "#2a2828", hat: "#1a1818", hatBand: "#3a2440", hair: "#141210", neckerchief: "#5a1a1e" },
    face: { mustache: "handlebar", stubble: 0.1, squint: 0.45 },
    hat: { style: "flat", crown: 0.1, brim: 0.17, curl: 0.0, crease: 0 },
    signature: ["suits"],
  }),
  // Buckskin jacket with fringe, twin revolvers.
  calamity_janet: variant({
    ...WOMAN,
    face: { ...WOMAN.face, squint: 0.5 },
    coat: "fringe",
    vest: false,
    twoGuns: true,
    height: 0.97,
    hair: "long",
    palette: { coat: "#a7845a", shirt: "#8a6c4a", trousers: "#5a4a3a", hat: "#6a5038", hair: "#7a3a1e", skin: "#d4a07c", eyes: "#5a7a4a" },
    hat: { style: "slouch", crown: 0.11, brim: 0.18, curl: -0.02, crease: 0.02 },
  }),
  // Poncho, sombrero, a scar across the face.
  el_gringo: variant({
    coat: "poncho",
    vest: false,
    bulk: 1.05,
    palette: { coat: "#7a3020", accent: "#d8a040", shirt: "#d8ccb0", trousers: "#4a3e30", hat: "#8a6a3a", skin: "#a8714f", hair: "#141210", eyes: "#3a2a1a" },
    face: { mustache: "walrus", stubble: 0.8, squint: 0.55, brow: -0.003 },
    hat: { style: "sombrero", crown: 0.2, brim: 0.32, curl: 0, crease: 0 },
    signature: ["scar"],
  }),
  // Long coat, a dark bandana, hard eyes.
  jesse_jones: variant({
    coat: "duster",
    vest: true,
    palette: { coat: "#4a4038", vest: "#2a2420", hat: "#222020", neckerchief: "#2a3a5a", trousers: "#3a3632", hair: "#2a1e16" },
    face: { mustache: "chevron", stubble: 0.6, squint: 0.65, brow: -0.004 },
    hat: { crown: 0.13, brim: 0.2 },
  }),
  // French gentleman: top hat, plum frock coat, gold waistcoat.
  jourdonnais: variant({
    palette: { coat: "#3a2e4a", vest: "#c8b070", shirt: "#f0ece0", trousers: "#4a4a52", hat: "#181818", hatBand: "#3a2e4a", hair: "#6a6a6a", neckerchief: "#f0ece0" },
    face: { mustache: "handlebar", nose: 1.15, stubble: 0.05, squint: 0.25 },
    hat: { style: "top", crown: 0.17, brim: 0.13, curl: 0.025, crease: 0 },
  }),
  // Scout: fringe jacket, beard, a telescope on the belt.
  kit_carlson: variant({
    coat: "fringe",
    vest: false,
    palette: { coat: "#8a6a40", shirt: "#6a5a40", trousers: "#4a3e30", hat: "#5a4a30", hair: "#6a4a2a" },
    face: { mustache: "walrus", beard: true, stubble: 0.5, squint: 0.55 },
    hat: { style: "slouch", crown: 0.11, brim: 0.19, curl: -0.03, crease: 0.025 },
    signature: ["telescope"],
  }),
  // Dandy: green frock coat, mustard waistcoat, derby, a lucky horseshoe pin.
  lucky_duke: variant({
    palette: { coat: "#2e4a3a", vest: "#b8862a", shirt: "#f0e6d0", trousers: "#5a4a3a", hat: "#2a2420", hair: "#4a2e1a", neckerchief: "#7a1a2a" },
    face: { mustache: "handlebar", stubble: 0.05, squint: 0.2 },
    hat: { style: "derby", crown: 0.11, brim: 0.13, curl: 0.03, crease: 0 },
    signature: ["horseshoe"],
  }),
  // Rider: leather chaps, no coat, always near a horse.
  paul_regret: variant({
    coat: "none",
    chaps: true,
    palette: { shirt: "#a05030", vest: "#3a2a20", trousers: "#5a5048", hat: "#4a3a2a", neckerchief: "#d0a030", hair: "#3a2414" },
    face: { mustache: "none", stubble: 0.85, squint: 0.4 },
    hat: { brim: 0.2 },
  }),
  // Vaquero: short jacket, silver conchos down the trousers, sombrero.
  pedro_ramirez: variant({
    coat: "suit",
    vest: false,
    palette: { coat: "#2a2420", shirt: "#e8dcc4", trousers: "#2a2420", hat: "#c8a870", accent: "#2a6a4a", skin: "#a8714f", hair: "#141210", neckerchief: "#2a6a4a" },
    face: { mustache: "walrus", stubble: 0.3, squint: 0.35 },
    hat: { style: "sombrero", crown: 0.18, brim: 0.3, curl: 0, crease: 0 },
    signature: ["conchos"],
  }),
  // Sharpshooter: long coat, red scarf.
  rose_doolan: variant({
    ...WOMAN,
    face: { ...WOMAN.face, squint: 0.55 },
    coat: "duster",
    vest: true,
    hair: "bun",
    palette: { coat: "#6a5a48", vest: "#3a2c24", shirt: "#d8ccb4", trousers: "#4a4038", hat: "#4a3626", hair: "#8a3a20", accent: "#b02a2a", skin: "#e0b090", eyes: "#4a6a8a" },
    hat: { crown: 0.115, brim: 0.17 },
    signature: ["scarf"],
  }),
  // Grizzled drinker: worn coat, grey beard, a flask and a bandaged head.
  sid_ketchum: variant({
    vest: false,
    bulk: 1.06,
    palette: { coat: "#5a5040", shirt: "#b8ac90", trousers: "#4a443a", hat: "#4a4036", hair: "#8a7e70", skin: "#c08a6a" },
    face: { mustache: "walrus", beard: true, stubble: 1, squint: 0.7, nose: 1.1 },
    hat: { style: "slouch", crown: 0.1, brim: 0.18, curl: -0.04, crease: 0.03 },
    signature: ["flask", "bandage"],
  }),
  // Huge bounty hunter: duster, two guns, black beard.
  slab_the_killer: variant({
    coat: "duster",
    bulk: 1.28,
    height: 1.06,
    twoGuns: true,
    palette: { coat: "#3a3430", vest: "#2a2420", trousers: "#2e2a26", hat: "#1e1c1a", hair: "#141210", skin: "#b88468" },
    face: { mustache: "walrus", beard: true, stubble: 0.9, squint: 0.6, jaw: 1.15, brow: -0.006 },
    hat: { crown: 0.13, brim: 0.2 },
  }),
  // Saloon singer: crimson dress, feathered hat, golden hair up.
  suzy_lafayette: variant({
    ...WOMAN,
    face: { ...WOMAN.face, squint: 0.25 },
    coat: "dress",
    vest: false,
    hair: "bun",
    height: 0.96,
    palette: { coat: "#8a1a3a", accent: "#e8c860", hat: "#2a1a2a", hair: "#c8a050", skin: "#e8b898", eyes: "#3a6a9a", neckerchief: "#e8c860", boots: "#2a1a20" },
    hat: { style: "feather", crown: 0.085, brim: 0.12, curl: 0.03, crease: 0 },
  }),
  // Undertaker: black coat, stovepipe hat with a vulture feather, gaunt.
  vulture_sam: variant({
    bulk: 0.88,
    height: 1.04,
    palette: { coat: "#141414", vest: "#2a2a2a", shirt: "#d8d0c0", trousers: "#1e1e1e", hat: "#111111", hatBand: "#2a2a2a", hair: "#1a1a1a", skin: "#c8a890", neckerchief: "#2a2a2a" },
    face: { mustache: "none", stubble: 0.3, jaw: 0.9, nose: 1.2, squint: 0.5, brow: -0.002 },
    hat: { style: "stovepipe", crown: 0.22, brim: 0.12, curl: 0.0, crease: 0 },
    signature: ["feather"],
  }),
  // Teenage gunslinger: oversized hat, slight build.
  willy_the_kid: variant({
    coat: "none",
    bulk: 0.9,
    height: 0.93,
    palette: { vest: "#6a2a2a", shirt: "#d0c8b0", trousers: "#4a4a5a", hat: "#c8b090", hair: "#a07040", skin: "#e0b08a" },
    face: { mustache: "none", stubble: 0, jaw: 0.9, squint: 0.3 },
    hat: { crown: 0.14, brim: 0.23, curl: 0.06 },
  }),
};
