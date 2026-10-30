"use client";

import type { CardType } from "@/engine";

interface PlaceholderCharacterProps {
  tint: string;
  alive: boolean;
  weapon: CardType | null;
  jailed: boolean;
  dynamite: boolean;
  barrel: boolean;
  mustang: boolean;
}

const LONG_GUNS = new Set<CardType>(["winchester", "rev_carabine"]);

/**
 * docs/05 §11 placeholder: capsule body, sphere head, cone hat, box weapon, tinted per seat. Faces +z; the seat
 * rotates it towards the center. Status props make blue cards readable at a glance (docs/05 §5).
 */
export function PlaceholderCharacter({ tint, alive, weapon, jailed, dynamite, barrel, mustang }: PlaceholderCharacterProps) {
  const body = alive ? tint : "#5d5650";
  const longGun = weapon !== null && LONG_GUNS.has(weapon);
  return (
    <group>
      {/* A dead character lies on the ground. */}
      <group rotation={alive ? [0, 0, 0] : [-Math.PI / 2, 0, 0]} position={alive ? [0, 0, 0] : [0, 0.25, -0.6]}>
        <mesh position={[0, 0.85, 0]} castShadow>
          <capsuleGeometry args={[0.32, 0.9, 6, 12]} />
          <meshStandardMaterial color={body} roughness={0.8} />
        </mesh>
        <mesh position={[0, 1.75, 0]} castShadow>
          <sphereGeometry args={[0.24, 16, 12]} />
          <meshStandardMaterial color={alive ? "#e0b48a" : "#8a7d70"} roughness={0.7} />
        </mesh>
        {/* Hat: brim + crown */}
        <mesh position={[0, 1.95, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.42, 0.04, 20]} />
          <meshStandardMaterial color="#3b2a1d" roughness={0.9} />
        </mesh>
        <mesh position={[0, 2.12, 0]} castShadow>
          <coneGeometry args={[0.22, 0.32, 16]} />
          <meshStandardMaterial color="#3b2a1d" roughness={0.9} />
        </mesh>
        {/* Weapon on the right hip (Colt .45 when nothing is equipped); long guns are carried across the back. */}
        {alive &&
          (longGun ? (
            <mesh position={[0.1, 1.05, -0.36]} rotation={[0, 0, Math.PI / 4]} castShadow>
              <boxGeometry args={[0.07, 1.2, 0.07]} />
              <meshStandardMaterial color="#2a2522" metalness={0.4} roughness={0.5} />
            </mesh>
          ) : (
            <mesh position={[-0.38, 0.75, 0.05]} castShadow>
              <boxGeometry args={[0.08, weapon ? 0.38 : 0.28, 0.14]} />
              <meshStandardMaterial color="#2a2522" metalness={0.4} roughness={0.5} />
            </mesh>
          ))}
        {/* Dynamite on the belt */}
        {alive && dynamite && (
          <mesh position={[0.36, 0.8, 0.1]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, 0.32, 10]} />
            <meshStandardMaterial color="#c0392b" emissive="#7a1a10" />
          </mesh>
        )}
      </group>

      {/* Jail: a translucent cell around the character */}
      {jailed && alive && (
        <group>
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.7, 1.15, Math.sin(a) * 0.7]}>
                <cylinderGeometry args={[0.025, 0.025, 2.3, 6]} />
                <meshStandardMaterial color="#555" metalness={0.8} roughness={0.3} />
              </mesh>
            );
          })}
        </group>
      )}

      {/* Barrel beside them, Mustang (stretched boxes) tied behind */}
      {barrel && (
        <mesh position={[0.9, 0.45, 0.1]} castShadow>
          <cylinderGeometry args={[0.32, 0.36, 0.9, 14]} />
          <meshStandardMaterial color="#7b4f2a" roughness={0.9} />
        </mesh>
      )}
      {mustang && (
        <group position={[-0.9, 0, -1.1]} rotation={[0, Math.PI / 2, 0]}>
          <mesh position={[0, 1.0, 0]} castShadow>
            <boxGeometry args={[1.5, 0.6, 0.45]} />
            <meshStandardMaterial color="#6b4423" />
          </mesh>
          <mesh position={[0.85, 1.35, 0]} rotation={[0, 0, -0.6]} castShadow>
            <boxGeometry args={[0.6, 0.28, 0.3]} />
            <meshStandardMaterial color="#6b4423" />
          </mesh>
          {[-0.55, 0.55].map((x) =>
            [-0.15, 0.15].map((z) => (
              <mesh key={`${x}${z}`} position={[x, 0.36, z]} castShadow>
                <boxGeometry args={[0.1, 0.72, 0.1]} />
                <meshStandardMaterial color="#4e301a" />
              </mesh>
            )),
          )}
        </group>
      )}
    </group>
  );
}
