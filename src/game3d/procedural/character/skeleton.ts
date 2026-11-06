import { Bone, Skeleton, Vector3 } from "three";

/**
 * The one skeleton every character shares (docs/05 §5): same bone names, same rest pose, so every animation clip
 * plays on every character. Mixamo-style names keep the door open for imported clips later. Rest pose in metres,
 * character facing +Z, its left side on +X, all bone rotations identity (clips rotate in parent space).
 */
export const BONE_NAMES = [
  "Hips",
  "Spine",
  "Spine1",
  "Spine2",
  "Neck",
  "Head",
  "LeftShoulder",
  "LeftArm",
  "LeftForeArm",
  "LeftHand",
  "RightShoulder",
  "RightArm",
  "RightForeArm",
  "RightHand",
  "LeftUpLeg",
  "LeftLeg",
  "LeftFoot",
  "LeftToeBase",
  "RightUpLeg",
  "RightLeg",
  "RightFoot",
  "RightToeBase",
] as const;

export type BoneName = (typeof BONE_NAMES)[number];

export const BONE: Readonly<Record<BoneName, number>> = Object.fromEntries(BONE_NAMES.map((n, i) => [n, i])) as Record<BoneName, number>;

const PARENT: Readonly<Record<BoneName, BoneName | null>> = {
  Hips: null,
  Spine: "Hips",
  Spine1: "Spine",
  Spine2: "Spine1",
  Neck: "Spine2",
  Head: "Neck",
  LeftShoulder: "Spine2",
  LeftArm: "LeftShoulder",
  LeftForeArm: "LeftArm",
  LeftHand: "LeftForeArm",
  RightShoulder: "Spine2",
  RightArm: "RightShoulder",
  RightForeArm: "RightArm",
  RightHand: "RightForeArm",
  LeftUpLeg: "Hips",
  LeftLeg: "LeftUpLeg",
  LeftFoot: "LeftLeg",
  LeftToeBase: "LeftFoot",
  RightUpLeg: "Hips",
  RightLeg: "RightUpLeg",
  RightFoot: "RightLeg",
  RightToeBase: "RightFoot",
};

type P = readonly [number, number, number];
const LEFT: Partial<Record<BoneName, P>> = {
  LeftShoulder: [0.035, 1.45, -0.02],
  LeftArm: [0.185, 1.43, -0.03],
  LeftForeArm: [0.245, 1.155, -0.025],
  LeftHand: [0.285, 0.905, 0.0],
  LeftUpLeg: [0.092, 0.92, 0],
  LeftLeg: [0.098, 0.505, 0.015],
  LeftFoot: [0.1, 0.09, -0.02],
  LeftToeBase: [0.1, 0.018, 0.115],
};

/** Rest positions in model space (metres). */
export const REST: Readonly<Record<BoneName, P>> = (() => {
  const out: Partial<Record<BoneName, P>> = {
    Hips: [0, 0.97, 0],
    Spine: [0, 1.07, -0.005],
    Spine1: [0, 1.19, -0.01],
    Spine2: [0, 1.31, -0.01],
    Neck: [0, 1.5, -0.02],
    Head: [0, 1.585, 0.0],
  };
  for (const [name, p] of Object.entries(LEFT) as [BoneName, P][]) {
    out[name] = p;
    out[name.replace("Left", "Right") as BoneName] = [-p[0], p[1], p[2]];
  }
  return out as Record<BoneName, P>;
})();

export const rest = (name: BoneName): Vector3 => new Vector3(...REST[name]);

/** A fresh bone hierarchy in the rest pose (each character instance needs its own to pose independently). */
export function buildSkeleton(): { root: Bone; bones: Bone[]; skeleton: Skeleton } {
  const bones = BONE_NAMES.map((name) => {
    const b = new Bone();
    b.name = name;
    return b;
  });
  BONE_NAMES.forEach((name, i) => {
    const parent = PARENT[name];
    const bone = bones[i] as Bone;
    const p = REST[name];
    if (parent === null) {
      bone.position.set(...p);
      return;
    }
    const pp = REST[parent];
    bone.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]);
    (bones[BONE[parent]] as Bone).add(bone);
  });
  const root = bones[0] as Bone;
  root.updateMatrixWorld(true);
  return { root, bones, skeleton: new Skeleton(bones) };
}

export const parentOf = (name: BoneName): BoneName | null => PARENT[name];
