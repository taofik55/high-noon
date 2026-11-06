"use client";

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Object3D } from "three";
import { lathe, mat } from "../procedural/core/shapes";
import { PartList } from "../procedural/core/parts";
import { BONE } from "../procedural/character/skeleton";
import type { BuiltCharacter } from "../procedural/character/cowboy";
import { isMaterialKey, material } from "../procedural/materials";
import { Mesh } from "three";
import { animateHorse, buildHorse } from "../procedural/props/horse";
import { buildBarrel, buildDynamite } from "../procedural/props/props";

/** Iron cell bars around a jailed character (Jail, docs/05 §5): turned bars between two rings. */
function buildCell(): Group {
  const parts = new PartList({ skinned: false });
  const bar = lathe([[0.025, 0], [0.025, 2.3], [0.032, 2.32], [0.032, 2.36], [0, 2.38]], 6);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    parts.add(bar, { material: "steel", color: "#3a3a3a", matrix: mat([Math.cos(a) * 0.75, 0, Math.sin(a) * 0.75]) });
  }
  for (const y of [0.15, 2.2]) parts.add(lathe([[0.72, 0], [0.78, 0], [0.78, 0.06], [0.72, 0.06]], 28), { material: "steel", color: "#2e2e2e", matrix: mat([0, y, 0]) });
  const g = new Group();
  g.name = "status.jail";
  for (const [key, geo] of parts.build()) if (isMaterialKey(key)) g.add(Object.assign(new Mesh(geo, material(key)), { castShadow: true }));
  return g;
}

/** A spyglass hanging on the belt (Scope). */
function buildSpyglass(): Group {
  const parts = new PartList({ skinned: false });
  parts.add(lathe([[0, 0], [0.018, 0], [0.018, 0.08], [0.015, 0.085], [0.015, 0.16], [0.013, 0.165], [0.013, 0.22], [0.016, 0.225], [0, 0.225]], 12), { material: "brass", color: "#c09a4e" });
  const g = new Group();
  g.name = "status.scope";
  for (const [key, geo] of parts.build()) if (isMaterialKey(key)) g.add(Object.assign(new Mesh(geo, material(key)), { castShadow: true }));
  return g;
}

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
