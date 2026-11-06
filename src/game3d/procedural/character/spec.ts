/**
 * Everything that makes one character look different from another on the shared skeleton (docs/05 §5): colours,
 * build, face, hair, hat, garments and a signature prop. The master cowboy is DEFAULT_SPEC; the 16 characters are
 * variations of it (roster.ts).
 */
export type HatStyle = "cattleman" | "flat" | "sombrero" | "top" | "derby" | "slouch" | "feather" | "stovepipe";
export type Outer = "frock" | "duster" | "suit" | "fringe" | "poncho" | "dress" | "none";
export type Signature =
  | "cards"
  | "suits"
  | "scar"
  | "telescope"
  | "horseshoe"
  | "flask"
  | "bandage"
  | "feather"
  | "conchos"
  | "scarf";

export interface CharacterSpec {
  palette: {
    skin: string;
    hair: string;
    eyes: string;
    shirt: string;
    vest: string;
    coat: string;
    trousers: string;
    boots: string;
    belt: string;
    hat: string;
    hatBand: string;
    neckerchief: string;
    metal: string;
    /** Second colour for patterns (poncho stripes, dress trim). */
    accent: string;
  };
  body: "male" | "female";
  /** Torso and limb girth multiplier (0.88 gaunt … 1.3 huge). */
  bulk: number;
  /** Uniform scale of the whole character (0.92 a youngster … 1.06 a big man). */
  height: number;
  face: {
    /** Jaw half-width multiplier. */
    jaw: number;
    /** Nose size multiplier. */
    nose: number;
    /** 0 open … 1 narrow squint. */
    squint: number;
    mustache: "none" | "chevron" | "handlebar" | "walrus";
    beard: boolean;
    stubble: number;
    /** Brow height offset (m): negative = frowning. */
    brow: number;
  };
  hair: "short" | "long" | "bun";
  hat: {
    style: HatStyle;
    /** Crown height (m). */
    crown: number;
    /** Brim radius (m). */
    brim: number;
    /** Side curl of the brim (negative droops). */
    curl: number;
    /** Depth of the top crease. */
    crease: number;
  };
  coat: Outer;
  vest: boolean;
  /** Leather chaps over the trousers. */
  chaps: boolean;
  /** A second holster on the left hip. */
  twoGuns: boolean;
  signature: readonly Signature[];
}

export const DEFAULT_SPEC: CharacterSpec = {
  palette: {
    skin: "#c8946f",
    hair: "#3b2a1e",
    eyes: "#4a6a7a",
    shirt: "#c9bfa4",
    vest: "#3a2c24",
    coat: "#6a4c33",
    trousers: "#56504a",
    boots: "#3b2416",
    belt: "#5b3a20",
    hat: "#5a3f2a",
    hatBand: "#2b1d14",
    neckerchief: "#9a3324",
    metal: "#b08a4a",
    accent: "#8a2f24",
  },
  body: "male",
  bulk: 1,
  height: 1,
  face: { jaw: 1, nose: 1, squint: 0.35, mustache: "chevron", beard: false, stubble: 0.45, brow: 0 },
  hair: "short",
  hat: { style: "cattleman", crown: 0.125, brim: 0.19, curl: 0.05, crease: 0.03 },
  coat: "frock",
  vest: true,
  chaps: false,
  twoGuns: false,
  signature: [],
};
