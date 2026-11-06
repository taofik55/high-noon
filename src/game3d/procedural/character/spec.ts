/**
 * Everything that makes one character look different from another on the shared skeleton (docs/05 §5): colours,
 * build, face, hat and outer garment. The master cowboy is DEFAULT_SPEC; the 16 characters will be variations.
 */
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
  };
  /** Torso and limb girth multiplier (0.9 lean … 1.25 heavy). */
  bulk: number;
  face: {
    /** Jaw half-width multiplier. */
    jaw: number;
    /** Nose size multiplier. */
    nose: number;
    /** 0 open … 1 narrow squint. */
    squint: number;
    mustache: "none" | "chevron" | "handlebar" | "walrus";
    stubble: number;
    /** Brow height offset (m): negative = frowning. */
    brow: number;
  };
  hat: {
    /** Crown height (m). */
    crown: number;
    /** Brim radius (m). */
    brim: number;
    /** Side curl of the brim. */
    curl: number;
    /** Depth of the top crease. */
    crease: number;
  };
  coat: "frock" | "duster" | "none";
  vest: boolean;
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
  },
  bulk: 1,
  face: { jaw: 1, nose: 1, squint: 0.35, mustache: "chevron", stubble: 0.45, brow: 0 },
  hat: { crown: 0.125, brim: 0.19, curl: 0.05, crease: 0.03 },
  coat: "frock",
  vest: true,
};
