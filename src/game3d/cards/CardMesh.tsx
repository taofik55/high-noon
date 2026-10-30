"use client";

import { useEffect, useMemo } from "react";
import { BoxGeometry, MeshBasicMaterial, MeshStandardMaterial, type Material } from "three";
import type { ThreeElements } from "@react-three/fiber";
import type { CardId } from "@/engine";
import { cardBackTexture, cardFaceTexture } from "./cardTexture";

/** Physical card size in metres (63×88 mm ratio, scaled up to read well on the table). */
export const CARD_W = 0.63;
export const CARD_H = 0.88;

/** One geometry shared by every card (docs/05 §4). Box faces: +z = front, −z = back. */
const geometry = new BoxGeometry(CARD_W, CARD_H, 0.008);
const edge = new MeshStandardMaterial({ color: "#e9dcc0", roughness: 0.9 });

type CardMeshProps = Omit<ThreeElements["mesh"], "geometry" | "material"> & {
  cardId: CardId | null; // null = face down
  /** Unlit materials for the HUD hand (no scene lights there). */
  unlit?: boolean;
  dimmed?: boolean;
};

export function CardMesh({ cardId, unlit = false, dimmed = false, ...props }: CardMeshProps) {
  const material = useMemo<Material[]>(() => {
    const front = cardId ? cardFaceTexture(cardId) : cardBackTexture();
    const back = cardBackTexture();
    const color = dimmed ? "#777777" : "#ffffff";
    const make = (map: typeof front) =>
      unlit
        ? new MeshBasicMaterial({ map, color, transparent: true, alphaTest: 0.5 })
        : new MeshStandardMaterial({ map, color, roughness: 0.75, transparent: true, alphaTest: 0.5 });
    return [edge, edge, edge, edge, make(front), make(back)];
  }, [cardId, unlit, dimmed]);
  // Textures are cached and shared; only the per-card materials are released.
  useEffect(() => () => material.slice(4).forEach((m) => m.dispose()), [material]);
  return <mesh geometry={geometry} material={material} {...props} />;
}
