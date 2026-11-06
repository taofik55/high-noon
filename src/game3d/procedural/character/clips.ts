import { AnimationClip, Euler, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack } from "three";
import { REST, type BoneName } from "./skeleton";

/**
 * Hand-keyed clips on the shared skeleton (docs/05 §5 clip names). Keys are Euler offsets from the rest pose
 * (radians, XYZ, parent space): the rest pose has identity rotations, so an offset is the bone's rotation.
 * Rest pose: arms hanging. Raising an arm forward is a negative X rotation of the upper arm.
 */
type Key = readonly [time: number, x: number, y: number, z: number];
type Pose = Partial<Record<BoneName, readonly Key[]>>;

function clip(name: string, duration: number, pose: Pose, hips?: readonly Key[]): AnimationClip {
  const tracks = Object.entries(pose).map(([bone, keys]) => {
    const times: number[] = [];
    const values: number[] = [];
    const q = new Quaternion();
    for (const [t, x, y, z] of keys as Key[]) {
      times.push(t);
      q.setFromEuler(new Euler(x, y, z));
      values.push(q.x, q.y, q.z, q.w);
    }
    return new QuaternionKeyframeTrack(`${bone}.quaternion`, times, values);
  });
  if (hips) {
    const [rx, ry, rz] = REST.Hips;
    tracks.push(
      new VectorKeyframeTrack(
        "Hips.position",
        hips.map((k) => k[0]),
        hips.flatMap(([, x, y, z]) => [rx + x, ry + y, rz + z]),
      ) as unknown as QuaternionKeyframeTrack,
    );
  }
  return new AnimationClip(name, duration, tracks);
}

/** Looping keys: the last key repeats the first so loops are seamless. */
const loop = (d: number, ...vals: (readonly [number, number, number])[]): Key[] => {
  const n = vals.length;
  return [...vals, vals[0] as readonly [number, number, number]].map((v, i) => [(i / n) * d, ...v] as Key);
};

// Shared pieces: relaxed arms angle in slightly; the gun arm extended forward at shoulder height.
const ARM_REST_L = [0, 0, 0.08] as const;
const ARM_REST_R = [0, 0, -0.08] as const;

export function buildClips(): AnimationClip[] {
  const idle = clip("Idle", 4, {
    Spine: loop(4, [0.02, 0, 0], [0.035, 0, 0]),
    Spine1: loop(4, [0.0, 0, 0], [-0.02, 0, 0]),
    Spine2: loop(4, [-0.01, 0.02, 0], [-0.03, 0.0, 0], [-0.01, -0.02, 0]),
    Neck: loop(4, [0.02, 0.0, 0], [0.03, 0.08, 0], [0.02, 0.0, 0], [0.03, -0.06, 0]),
    LeftArm: loop(4, ARM_REST_L, [0.04, 0, 0.1]),
    RightArm: loop(4, ARM_REST_R, [0.04, 0, -0.1]),
    LeftForeArm: loop(4, [-0.15, 0, 0], [-0.2, 0, 0]),
    RightForeArm: loop(4, [-0.12, 0, 0], [-0.18, 0, 0]),
    LeftUpLeg: loop(4, [0, 0, 0.02], [0, 0, 0.03]),
    RightUpLeg: loop(4, [0, 0, -0.02], [0, 0, -0.035]),
  }, loop(4, [0, 0, 0], [0.008, -0.004, 0]));

  const s = 0.5; // swing
  const walk = clip("Walk", 1.1, {
    LeftUpLeg: loop(1.1, [-s, 0, 0], [0, 0, 0], [s * 0.8, 0, 0], [0, 0, 0]),
    RightUpLeg: loop(1.1, [s * 0.8, 0, 0], [0, 0, 0], [-s, 0, 0], [0, 0, 0]),
    LeftLeg: loop(1.1, [0.15, 0, 0], [0.6, 0, 0], [0.1, 0, 0], [0.25, 0, 0]),
    RightLeg: loop(1.1, [0.1, 0, 0], [0.25, 0, 0], [0.15, 0, 0], [0.6, 0, 0]),
    LeftFoot: loop(1.1, [0.25, 0, 0], [-0.2, 0, 0], [-0.25, 0, 0], [0, 0, 0]),
    RightFoot: loop(1.1, [-0.25, 0, 0], [0, 0, 0], [0.25, 0, 0], [-0.2, 0, 0]),
    LeftArm: loop(1.1, [0.35, 0, 0.1], [0, 0, 0.1], [-0.35, 0, 0.1], [0, 0, 0.1]),
    RightArm: loop(1.1, [-0.35, 0, -0.1], [0, 0, -0.1], [0.35, 0, -0.1], [0, 0, -0.1]),
    LeftForeArm: loop(1.1, [-0.3, 0, 0], [-0.2, 0, 0]),
    RightForeArm: loop(1.1, [-0.3, 0, 0], [-0.2, 0, 0]),
    Spine: loop(1.1, [0.05, 0.08, 0], [0.04, 0, 0], [0.05, -0.08, 0], [0.04, 0, 0]),
    Spine2: loop(1.1, [0, -0.1, 0], [0, 0, 0], [0, 0.1, 0], [0, 0, 0]),
  }, loop(1.1, [0, -0.03, 0], [0, 0.0, 0], [0, -0.03, 0], [0, 0, 0]));

  // Aim: right arm straight out at shoulder height, a slight lean into the shot, left arm back.
  const AIM = {
    RightArm: [-1.45, 0.25, 0.05] as const,
    RightForeArm: [-0.05, 0, 0] as const,
    RightHand: [0.1, 0, 0] as const,
    Spine2: [0, 0.25, 0] as const,
    Neck: [0.05, -0.22, 0] as const,
    LeftArm: [0.25, 0, 0.18] as const,
    LeftForeArm: [-0.4, 0, 0] as const,
  };
  const hold = (pose: Record<string, readonly [number, number, number]>, t: number) =>
    Object.fromEntries(Object.entries(pose).map(([b, v]) => [b, [[0, ...v], [t, ...v]] as Key[]])) as Pose;
  const aim = clip("Aim", 1, hold(AIM, 1));

  // Draw: hand dips to the holster, then rises to the aim.
  const draw = clip("Draw", 0.7, {
    RightArm: [[0, ...ARM_REST_R], [0.18, 0.25, 0, -0.25], [0.4, -0.6, 0.1, -0.1], [0.7, ...AIM.RightArm]],
    RightForeArm: [[0, -0.12, 0, 0], [0.18, -0.55, 0, 0], [0.4, -0.9, 0, 0], [0.7, ...AIM.RightForeArm]],
    Spine2: [[0, 0, 0, 0], [0.18, 0.08, -0.08, 0], [0.7, ...AIM.Spine2]],
    Neck: [[0, 0, 0, 0], [0.7, ...AIM.Neck]],
    LeftArm: [[0, ...ARM_REST_L], [0.7, ...AIM.LeftArm]],
    LeftForeArm: [[0, -0.15, 0, 0], [0.7, ...AIM.LeftForeArm]],
  });

  // Shoot: from the aim, a sharp muzzle climb and recoil through the shoulder, then settle.
  const shoot = clip("Shoot", 0.55, {
    ...hold(AIM, 0.55),
    RightArm: [[0, ...AIM.RightArm], [0.05, -1.7, 0.25, 0.05], [0.25, -1.48, 0.25, 0.05], [0.55, ...AIM.RightArm]],
    RightForeArm: [[0, ...AIM.RightForeArm], [0.05, -0.35, 0, 0], [0.3, -0.08, 0, 0], [0.55, ...AIM.RightForeArm]],
    Spine2: [[0, ...AIM.Spine2], [0.06, -0.06, 0.28, 0], [0.55, ...AIM.Spine2]],
  });

  const hit = clip("HitReact", 0.8, {
    Spine: [[0, 0, 0, 0], [0.12, -0.25, 0.1, 0.05], [0.8, 0, 0, 0]],
    Spine2: [[0, 0, 0, 0], [0.1, -0.2, 0.15, 0], [0.8, 0, 0, 0]],
    Neck: [[0, 0, 0, 0], [0.12, -0.3, 0.1, 0.1], [0.8, 0, 0, 0]],
    LeftArm: [[0, ...ARM_REST_L], [0.12, 0.3, 0, 0.45], [0.8, ...ARM_REST_L]],
    RightArm: [[0, ...ARM_REST_R], [0.12, 0.3, 0, -0.45], [0.8, ...ARM_REST_R]],
  }, [[0, 0, 0, 0], [0.12, 0, -0.02, -0.06], [0.8, 0, 0, 0]]);

  // Death_A: knees buckle, the body twists and falls backwards to lie on the ground.
  const death = clip("Death_A", 1.6, {
    Spine: [[0, 0, 0, 0], [0.3, 0.3, 0.2, 0], [1.0, -0.2, 0.1, 0], [1.6, -0.1, 0.1, 0]],
    Spine2: [[0, 0, 0, 0], [0.3, 0.2, 0.3, 0], [1.6, 0, 0.15, 0]],
    Neck: [[0, 0, 0, 0], [0.4, 0.3, 0, 0], [1.6, -0.3, 0.4, 0]],
    LeftUpLeg: [[0, 0, 0, 0], [0.4, -0.7, 0, 0.1], [1.0, -0.2, 0, 0.2], [1.6, -0.15, 0, 0.25]],
    RightUpLeg: [[0, 0, 0, 0], [0.4, -0.4, 0, -0.1], [1.0, -0.6, 0, -0.1], [1.6, -0.25, 0, -0.15]],
    LeftLeg: [[0, 0, 0, 0], [0.4, 1.2, 0, 0], [1.6, 0.3, 0, 0]],
    RightLeg: [[0, 0, 0, 0], [0.4, 0.8, 0, 0], [1.6, 0.9, 0, 0]],
    LeftArm: [[0, ...ARM_REST_L], [0.5, -0.4, 0, 0.9], [1.6, 0.2, 0, 1.3]],
    RightArm: [[0, ...ARM_REST_R], [0.5, -0.6, 0, -0.6], [1.6, 0.1, 0, -1.2]],
    Hips: [[0, 0, 0, 0], [0.4, 0.1, 0.25, 0], [1.0, -0.6, 0.4, 0], [1.6, -1.45, 0.45, 0.1]],
  }, [[0, 0, 0, 0], [0.4, 0, -0.35, -0.05], [1.0, 0, -0.65, -0.3], [1.6, 0, -0.82, -0.55]]);

  return [idle, walk, draw, aim, shoot, hit, death];
}
