"use client";

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { Object3D } from "three";
import { BONE } from "../procedural/character/skeleton";
import type { BuiltCharacter } from "../procedural/character/cowboy";
import { animateHorse, buildHorse } from "../procedural/props/horse";
import { buildBarrel, buildCell, buildDynamite, buildSpyglass } from "../procedural/props/props";

interface SeatPropsProps {
  character: BuiltCharacter | null;
  alive: boolean;
  jailed: boolean;
  dynamite: boolean;
  barrel: boolean;
  mustang: boolean;
  scope: boolean;
}

/**
 * Status visuals for blue cards in play (docs/05 §5), in the seat's frame (the character faces +z): a cell for
 * Jail, a barrel beside them, a saddled horse tied behind for Mustang, dynamite and a spyglass on the belt.
 */
export function SeatProps({ character, alive, jailed, dynamite, barrel, mustang, scope }: SeatPropsProps) {
  const cell = useMemo(() => (jailed ? buildCell() : null), [jailed]);
  const keg = useMemo(() => (barrel ? buildBarrel().group : null), [barrel]);
  const horse = useMemo(() => (mustang ? buildHorse({ saddle: true }) : null), [mustang]);
  const tnt = useMemo(() => (dynamite ? buildDynamite(true).group : null), [dynamite]);
  const glass = useMemo(() => (scope ? buildSpyglass() : null), [scope]);

  // Belt items ride on the hips bone so they follow every clip.
  useEffect(() => {
    const hips = character?.skeleton.bones[BONE.Hips] as Object3D | undefined;
    if (!hips) return;
    const items: Object3D[] = [];
    if (tnt && alive) {
      tnt.position.set(0.17, -0.07, 0.07);
      tnt.rotation.set(0.15, 0, -0.1);
      hips.add(tnt);
      items.push(tnt);
    }
    if (glass && alive) {
      glass.position.set(0.15, -0.16, -0.09);
      glass.rotation.set(0.2, 0, 0.15);
      hips.add(glass);
      items.push(glass);
    }
    return () => items.forEach((o) => o.removeFromParent());
  }, [character, tnt, glass, alive]);

  useFrame(({ clock }) => {
    if (horse) animateHorse(horse, clock.elapsedTime, "idle");
  });

  return (
    <>
      {cell && alive && <primitive object={cell} />}
      {keg && <primitive object={keg} position={[0.95, 0, 0.15]} rotation={[0, 0.4, 0]} />}
      {horse && <primitive object={horse.group} position={[-1.1, 0, -1.4]} rotation={[0, Math.PI / 2 + 0.25, 0]} />}
    </>
  );
}
