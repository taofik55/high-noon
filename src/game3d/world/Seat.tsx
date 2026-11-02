"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import type { Group, MeshStandardMaterial } from "three";
import { cardType, equippedWeapon, type PublicPlayer } from "@/engine";
import { resolveAsset } from "../assets/manifest";
import { CardMesh, CARD_W } from "../cards/CardMesh";
import { PlaceholderCharacter } from "../characters/PlaceholderCharacter";
import { createRig } from "../characters/rig";
import { registerRig } from "../director/registry";
import type { RigApi } from "../director/types";
import { useUi3D } from "../uiStore";
import { facingCenter, towardsCenter, type Vec3 } from "./layout";

interface SeatProps {
  player: PublicPlayer;
  position: Vec3;
  tint: string;
  isTurn: boolean;
  isActing: boolean;
  targetable: boolean;
  /** Presented view version: every new view resets the character to its seat pose. */
  version: number;
  onSelect: (seat: number) => void;
}

function hasType(p: PublicPlayer, type: string): boolean {
  return p.inPlay.some((id) => cardType(id) === type);
}

/** One seat of the ring (docs/05 §2): character, ground ring, crate with in-play cards. Name plates: hud/SeatBadges. */
export function Seat({ player, position, tint, isTurn, isActing, targetable, version, onSelect }: SeatProps) {
  const ring = useRef<MeshStandardMaterial>(null);
  const anim = useRef<Group>(null);
  const rig = useRef<RigApi | null>(null);

  // The Director animates this group by clip name (docs/05 §5–6).
  useEffect(() => {
    if (!anim.current) return;
    rig.current = createRig(anim.current);
    return registerRig(player.seat, rig.current);
  }, [player.seat]);

  // Scenes are self-contained per update: once the next view is shown, the character is back at its seat pose
  // (before paint, so a death fall never stacks with the static "lying" pose of a dead player).
  useLayoutEffect(() => {
    rig.current?.reset();
  }, [version]);
  const setHoveredSeat = useUi3D((s) => s.setHoveredSeat);
  const rotationY = facingCenter(position);
  const crate = towardsCenter(position, 1.6);
  const asset = resolveAsset(`char.${player.characterId ?? "bart_cassidy"}`);

  // Valid targets pulse green; the player who must act glows amber.
  useFrame(({ clock }) => {
    const m = ring.current;
    if (!m) return;
    if (targetable) m.emissiveIntensity = 1.2 + Math.sin(clock.elapsedTime * 6) * 0.6;
    else m.emissiveIntensity = isActing ? 0.9 : isTurn ? 0.4 : 0.05;
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHoveredSeat(player.seat);
    if (targetable) document.body.style.cursor = "pointer";
  };
  const out = () => {
    if (useUi3D.getState().hoveredSeat === player.seat) setHoveredSeat(null);
    document.body.style.cursor = "";
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (targetable) onSelect(player.seat);
  };

  return (
    <group>
      <group position={position} rotation={[0, rotationY, 0]} onPointerOver={over} onPointerOut={out} onClick={click}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
          <ringGeometry args={[0.85, 1.15, 40]} />
          <meshStandardMaterial
            ref={ring}
            color={targetable ? "#3fbf6f" : isActing ? "#f2b84b" : "#5a4632"}
            emissive={targetable ? "#2fff7a" : isActing || isTurn ? "#f2b84b" : "#000000"}
          />
        </mesh>
        <group ref={anim}>
          {/* Invisible, generous hit area so the character is easy to click or drop a card on. */}
          <mesh position={[0, 1.1, 0]} visible={false}>
            <cylinderGeometry args={[0.9, 0.9, 2.4, 12]} />
          </mesh>
          {asset.source === "placeholder" && (
            <PlaceholderCharacter
              tint={tint}
              alive={player.alive}
              weapon={equippedWeapon(player)}
              jailed={hasType(player, "jail")}
              dynamite={hasType(player, "dynamite")}
              barrel={hasType(player, "barrel")}
              mustang={hasType(player, "mustang")}
            />
          )}
        </group>
        {/* The undertaker's work (docs/05 §6.1 ELIMINATED) */}
        {!player.alive && (
          <group position={[0.9, 0, -0.6]}>
            <mesh position={[0, 0.55, 0]} castShadow>
              <boxGeometry args={[0.55, 1.1, 0.14]} />
              <meshStandardMaterial color="#8d8a84" roughness={1} />
            </mesh>
            <mesh position={[0, 0.06, 0.55]} receiveShadow>
              <boxGeometry args={[0.7, 0.12, 1.1]} />
              <meshStandardMaterial color="#7a5a3a" roughness={1} />
            </mesh>
          </group>
        )}
      </group>

      {/* Crate with the in-play blue cards laid on top */}
      <group position={crate} rotation={[0, rotationY, 0]}>
        <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
          <boxGeometry args={[Math.max(1.3, player.inPlay.length * 0.7 + 0.2), 0.5, 0.95]} />
          <meshStandardMaterial color="#8b6a43" roughness={0.95} />
        </mesh>
        {player.inPlay.map((id, i) => (
          <CardMesh
            key={id}
            cardId={id}
            position={[(i - (player.inPlay.length - 1) / 2) * (CARD_W + 0.06), 0.51, 0]}
            rotation={[-Math.PI / 2, 0, Math.PI]}
            scale={0.95}
            castShadow
          />
        ))}
      </group>

    </group>
  );
}
