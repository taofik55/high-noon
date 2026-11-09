"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { CanvasTexture, MeshBasicMaterial, PlaneGeometry, Vector3, type AnimationClip, type Group, type MeshStandardMaterial } from "three";
import { cardType, equippedWeapon, type CardType, type PublicPlayer } from "@/engine";
import { placeholdersOnly } from "../assetMode";
import { CardMesh, CARD_W } from "../cards/CardMesh";
import { PlaceholderCharacter } from "../characters/PlaceholderCharacter";
import { createRig } from "../characters/rig";
import { SeatProps } from "../characters/SeatProps";
import { createSkeletalRig, type SkeletalRig } from "../characters/skeletalRig";
import { buildClips } from "../procedural/character/clips";
import { buildCharacter, type BuiltCharacter } from "../procedural/character/cowboy";
import { ROSTER } from "../procedural/character/roster";
import { DEFAULT_SPEC } from "../procedural/character/spec";
import { buildCrate, buildGrave } from "../procedural/props/props";
import { buildWeapon, LONG_GUNS, WEAPON_IDS, type WeaponId } from "../procedural/weapons";
import { registerRig } from "../director/registry";
import { pickLod, QUALITY_CONFIG, resolveQuality } from "../settings/quality";
import { useSettings } from "../settings/settingsStore";
import type { RigApi } from "../director/types";
import { enqueue, PRIORITY } from "../streaming/buildQueue";
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

// One set of clips for every character: they all share the skeleton.
let clipCache: AnimationClip[] | null = null;
const sharedClips = () => (clipCache ??= buildClips());

const isSkeletal = (r: RigApi | null): r is SkeletalRig => !!r && "update" in r;

/** Blob shadow for the low preset (docs/05 §8): a soft dark disc under each character, shared by every seat. */
let blob: { geometry: PlaneGeometry; material: MeshBasicMaterial } | null = null;
function blobShadow(): typeof blob {
  if (blob || typeof document === "undefined") return blob;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, "rgba(40,24,10,0.55)");
  g.addColorStop(1, "rgba(40,24,10,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  blob = {
    geometry: new PlaneGeometry(1.3, 1.3).rotateX(-Math.PI / 2),
    material: new MeshBasicMaterial({ map: new CanvasTexture(c), transparent: true, depthWrite: false }),
  };
  return blob;
}

const toWeaponId = (w: CardType | null): WeaponId => (w && (WEAPON_IDS as readonly string[]).includes(w) ? (w as WeaponId) : "colt45");

let buildSeq = 0;

function build(characterId: PublicPlayer["characterId"]): BuiltCharacter | null {
  try {
    return buildCharacter(characterId ? ROSTER[characterId] : DEFAULT_SPEC);
  } catch (e) {
    console.error("[character] falling back to the placeholder", e);
    return null;
  }
}

/**
 * The seat's character, built from the roster through the build queue (the placeholder stands in meanwhile); null
 * keeps the placeholder (Golden rule 6). Each seat gets its own instance: every character needs its own skeleton.
 */
function useCharacter(seat: number, characterId: PublicPlayer["characterId"]): BuiltCharacter | null {
  const [built, setBuilt] = useState<{ key: string; character: BuiltCharacter | null } | null>(null);
  const key = `${seat}:${characterId ?? "default"}`;
  useEffect(() => {
    if (placeholdersOnly()) return;
    let alive = true;
    // Unique per mount: a remounted seat must not reuse a character still attached to the old scene graph.
    void enqueue(`character:${key}:${++buildSeq}`, "characters", PRIORITY.essential, () => build(characterId)).then((character) => {
      if (alive) setBuilt({ key, character });
    });
    return () => {
      alive = false;
    };
  }, [key, characterId]);
  return built?.key === key ? built.character : null;
}

/** One seat of the ring (docs/05 §2): character, ground ring, crate with in-play cards. Name plates: hud/SeatBadges. */
export function Seat({ player, position, tint, isTurn, isActing, targetable, version, onSelect }: SeatProps) {
  const ring = useRef<MeshStandardMaterial>(null);
  const anim = useRef<Group>(null);
  const rig = useRef<RigApi | null>(null);

  const character = useCharacter(player.seat, player.characterId);
  const alive = useRef(player.alive);
  useLayoutEffect(() => {
    alive.current = player.alive;
  });
  const weapon = equippedWeapon(player);

  // The Director animates this group by clip name (docs/05 §5–6): through the skeleton when there is a character,
  // otherwise with the placeholder's procedural tweens.
  useEffect(() => {
    if (!anim.current) return;
    const r = character ? createSkeletalRig(anim.current, character, sharedClips()) : createRig(anim.current);
    rig.current = r;
    if (isSkeletal(r)) {
      r.setDead(!alive.current);
      r.reset();
    }
    const unregister = registerRig(player.seat, r);
    return () => {
      unregister();
      if (isSkeletal(r)) r.dispose();
      rig.current = null;
    };
  }, [player.seat, character]);

  // The gun follows the equipped weapon card (Colt .45 by default).
  useEffect(() => {
    const r = rig.current;
    if (!isSkeletal(r)) return;
    const id = toWeaponId(weapon);
    r.setGun(buildWeapon(id).group, LONG_GUNS.has(id));
  }, [weapon, character]);

  // Scenes are self-contained per update: once the next view is shown, the character is back at its seat pose
  // (before paint, so a death fall never stacks with the static "lying" pose of a dead player).
  useLayoutEffect(() => {
    const r = rig.current;
    if (isSkeletal(r)) r.setDead(!player.alive);
    r?.reset();
  }, [version, player.alive]);

  const lodDistance = useSettings((s) => QUALITY_CONFIG[resolveQuality(s.quality, s.autoLevel)].lodDistance);
  const realShadows = useSettings((s) => QUALITY_CONFIG[resolveQuality(s.quality, s.autoLevel)].shadows);
  const blobParts = realShadows ? null : blobShadow();
  const worldPos = useRef(new Vector3());
  useFrame(({ camera }, dt) => {
    const r = rig.current;
    if (isSkeletal(r)) r.update(dt);
    // Distance LOD (docs/05 §9): close-ups in cinematics bring the full model back automatically.
    if (character && anim.current) {
      const d = anim.current.getWorldPosition(worldPos.current).distanceTo(camera.position);
      const lod = pickLod(character.lod, d, lodDistance);
      if (lod !== character.lod) character.setLod(lod);
    }
  });

  const grave = useMemo(() => (player.alive ? null : buildGrave().group), [player.alive]);
  const crateWidth = Math.max(1.3, Math.round((player.inPlay.length * 0.7 + 0.2) * 10) / 10);
  const crateProp = useMemo(() => buildCrate(crateWidth).group, [crateWidth]);
  const setHoveredSeat = useUi3D((s) => s.setHoveredSeat);
  const rotationY = facingCenter(position);
  const crate = towardsCenter(position, 1.6);

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
          {blobParts && <mesh geometry={blobParts.geometry} material={blobParts.material} position={[0, 0.03, 0]} raycast={() => null} />}
          {character ? (
            <primitive object={character.group} />
          ) : (
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
        {character && (
          <SeatProps
            character={character}
            alive={player.alive}
            jailed={hasType(player, "jail")}
            dynamite={hasType(player, "dynamite")}
            barrel={hasType(player, "barrel")}
            mustang={hasType(player, "mustang")}
            scope={hasType(player, "scope")}
          />
        )}
        {/* The undertaker's work (docs/05 §6.1 ELIMINATED) */}
        {grave && <primitive object={grave} position={[0.9, 0, -0.6]} />}
      </group>

      {/* Crate with the in-play blue cards laid on top */}
      <group position={crate} rotation={[0, rotationY, 0]}>
        <primitive object={crateProp} />
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
