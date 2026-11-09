"use client";

import { useEffect, useMemo } from "react";
import { BoxGeometry, MeshBasicMaterial, MeshStandardMaterial, type Material } from "three";
import type { ThreeElements } from "@react-three/fiber";
import type { CardId } from "@/engine";
import { cardBackTexture, cardFaceTexture } from "./cardTexture";

/** Physical card size in metres (63×88 mm ratio, scaled up to read well on the table). */
export const CARD_W = 0.63;
export const CARD_H = 0.88;

/**
 * One geometry shared by every card (docs/05 §4): a thin box whose four edges form one material group, then the
 * front (+z) and the back (−z). Three draw calls per card instead of the box's six.
 */
export const CARD_GEOMETRY = cardGeometry();

function cardGeometry(): BoxGeometry {
  const g = new BoxGeometry(CARD_W, CARD_H, 0.008);
  // BoxGeometry lays its faces out in order +x, −x, +y, −y, +z, −z, six indices each.
  g.clearGroups();
  g.addGroup(0, 24, 0);
  g.addGroup(24, 6, 1);
  g.addGroup(30, 6, 2);
  return g;
}
const edge = new MeshStandardMaterial({ color: "#e9dcc0", roughness: 0.9 });

/**
 * Materials for one card: the shared edge material, then front and back. Only the last two are per card; dispose
 * them with disposeCardMaterials (textures are cached and shared).
 */
export function cardMaterials(cardId: CardId | null, opts: { unlit?: boolean; dimmed?: boolean } = {}): Material[] {
  const front = cardId ? cardFaceTexture(cardId) : cardBackTexture();
  const back = cardBackTexture();
  const color = opts.dimmed ? "#777777" : "#ffffff";
  const make = (map: typeof front) =>
    opts.unlit
      ? // HUD cards show their texture as drawn, whether or not a post-processing composer owns tone mapping.
        new MeshBasicMaterial({ map, color, transparent: true, alphaTest: 0.5, toneMapped: false })
      : new MeshStandardMaterial({ map, color, roughness: 0.75, transparent: true, alphaTest: 0.5 });
  return [edge, make(front), make(back)];
}

export function disposeCardMaterials(materials: Material[]): void {
  materials.slice(1).forEach((m) => m.dispose());
}

type CardMeshProps = Omit<ThreeElements["mesh"], "geometry" | "material"> & {
  cardId: CardId | null; // null = face down
  /** Unlit materials for the HUD hand (no scene lights there). */
  unlit?: boolean;
  dimmed?: boolean;
};

export function CardMesh({ cardId, unlit = false, dimmed = false, ...props }: CardMeshProps) {
  const material = useMemo(() => cardMaterials(cardId, { unlit, dimmed }), [cardId, unlit, dimmed]);
  useEffect(() => () => disposeCardMaterials(material), [material]);
  return <mesh geometry={CARD_GEOMETRY} material={material} {...props} />;
}
