import { Group, Object3D, SkinnedMesh, type BufferGeometry, type Skeleton } from "three";
import { PartList, triangleCount } from "../core/parts";
import { isMaterialKey, material } from "../materials";
import { buildArms, buildLegs, buildTorso } from "./body";
import { buildSignature } from "./extras";
import { buildGear, HOLSTER_SOCKET } from "./gear";
import { buildHands } from "./hands";
import { buildHat } from "./hat";
import { buildHead } from "./head";
import { BONE, buildSkeleton, rest } from "./skeleton";
import { DEFAULT_SPEC, type CharacterSpec } from "./spec";

export interface BuiltCharacter {
  group: Group;
  skeleton: Skeleton;
  /** Empty objects on bones where weapons attach: the right palm and the holster. */
  sockets: { rightHand: Object3D; holster: Object3D; holsterLeft: Object3D | null };
  /** False when the outfit has no gun belt (the holster socket is then empty). */
  hasHolster: boolean;
  triangles: number;
}

const geometryCache = new Map<string, Map<string, BufferGeometry>>();

/** Geometry per material for a spec; cached, so many characters with the same look share buffers. */
export function characterGeometry(spec: CharacterSpec): Map<string, BufferGeometry> {
  const key = JSON.stringify(spec);
  const hit = geometryCache.get(key);
  if (hit) return hit;
  const parts = new PartList({ skinned: true });
  buildLegs(parts, spec);
  buildTorso(parts, spec);
  buildArms(parts, spec);
  buildHands(parts, spec);
  buildHead(parts, spec);
  buildHat(parts, spec);
  buildGear(parts, spec);
  buildSignature(parts, spec);
  const built = parts.build();
  geometryCache.set(key, built);
  return built;
}

/**
 * A complete character on its own copy of the shared skeleton: one SkinnedMesh per surface material (a handful of
 * draw calls), shared geometry and materials, and sockets for the revolver.
 */
export function buildCharacter(spec: CharacterSpec = DEFAULT_SPEC): BuiltCharacter {
  const { root, bones, skeleton } = buildSkeleton();
  const group = new Group();
  group.name = "character";
  group.add(root);
  let triangles = 0;
  for (const [key, geometry] of characterGeometry(spec)) {
    if (!isMaterialKey(key)) continue;
    const mesh = new SkinnedMesh(geometry, material(key));
    mesh.name = `character.${key}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // Skinned bounds follow the rest pose; never cull a character that is mid-animation.
    mesh.frustumCulled = false;
    group.add(mesh);
    mesh.bind(skeleton);
    triangles += triangleCount(geometry);
  }

  const rightHand = new Object3D();
  rightHand.name = "socket.rightHand";
  // Grip centre in the fist, in the RightHand bone's (rest-aligned) space. Handshake grip: the barrel runs along the
  // hand (gun +Z → -Y) and the butt points to the little-finger side (gun -Y → -Z), so with the arm raised to aim
  // the barrel points forward and the butt down.
  rightHand.position.set(0.004, -0.062, 0.004);
  rightHand.rotation.set(Math.PI / 2, 0, 0);
  (bones[BONE.RightHand] as Object3D).add(rightHand);

  const holster = new Object3D();
  holster.name = "socket.holster";
  const hips = rest("Hips");
  holster.position.set(HOLSTER_SOCKET.position[0] - hips.x, HOLSTER_SOCKET.position[1] - hips.y, HOLSTER_SOCKET.position[2] - hips.z);
  holster.rotation.set(...HOLSTER_SOCKET.rotation);
  (bones[BONE.Hips] as Object3D).add(holster);

  // Two-gun characters carry a second revolver in a mirrored holster on the left (never drawn: one gun is enough).
  let holsterLeft: Object3D | null = null;
  if (spec.twoGuns) {
    holsterLeft = new Object3D();
    holsterLeft.name = "socket.holsterLeft";
    holsterLeft.position.set(-holster.position.x, holster.position.y, holster.position.z);
    holsterLeft.rotation.set(HOLSTER_SOCKET.rotation[0], -HOLSTER_SOCKET.rotation[1], -HOLSTER_SOCKET.rotation[2]);
    (bones[BONE.Hips] as Object3D).add(holsterLeft);
  }
  // Height varies by uniform scale, so every clip still fits the shared skeleton.
  group.scale.setScalar(spec.height);
  return { group, skeleton, sockets: { rightHand, holster, holsterLeft }, hasHolster: spec.coat !== "dress", triangles };
}
