"use client";

import { useMemo } from "react";
import type { CardId } from "@/engine";
import { buildBuckboard } from "../procedural/props/props";
import { CardMesh, CARD_H, CARD_W } from "./CardMesh";

const THICKNESS = 0.006;
const TOP = 1.12;

/** The central wagon with the draw deck (height follows its size) and the face-up discard pile (docs/05 §2). */
export function CenterPile({ deckCount, discardTop }: { deckCount: number; discardTop: CardId | null }) {
  const stack = Math.max(0.01, deckCount * THICKNESS);
  const wagon = useMemo(() => buildBuckboard().group, []);
  return (
    <group>
      {/* Wagon: a buckboard bed on spoked wheels */}
      <primitive object={wagon} />

      {/* Deck: a block whose height shows how many cards are left, a face-down card on top */}
      {deckCount > 0 && (
        <group position={[-0.6, TOP, 0]}>
          <mesh position={[0, stack / 2, 0]} castShadow>
            <boxGeometry args={[CARD_W, stack, CARD_H]} />
            <meshStandardMaterial color="#e9dcc0" roughness={0.9} />
          </mesh>
          <CardMesh cardId={null} position={[0, stack + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} />
        </group>
      )}

      {/* Discard pile: the top card face up */}
      {discardTop && <CardMesh cardId={discardTop} position={[0.6, TOP + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0.12]} castShadow />}
    </group>
  );
}
