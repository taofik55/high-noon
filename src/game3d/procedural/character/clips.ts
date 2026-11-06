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

  return [idle, walk, draw, aim, shoot, hit, death, ...moreClips(AIM, hold)];
}

/** Holds a pose between two rest keys: rest → pose (at `inT`) → hold → rest (at `d`), or stays if `stay`. */
function pose(d: number, inT: number, p: Record<string, readonly [number, number, number]>, stay = false): Pose {
  return Object.fromEntries(
    Object.entries(p).map(([b, v]) => {
      const keys: Key[] = [[0, 0, 0, 0], [inT, ...v]];
      if (stay) keys.push([d, ...v]);
      else keys.push([d - inT, ...v], [d, 0, 0, 0]);
      return [b, keys];
    }),
  ) as Pose;
}

function moreClips(
  AIM: Record<string, readonly [number, number, number]>,
  hold: (pose: Record<string, readonly [number, number, number]>, t: number) => Pose,
): AnimationClip[] {
  // Hand to the chin, head tilted: weighing the options.
  const think = clip("Think", 1.6, pose(1.6, 0.35, { RightArm: [-0.75, 0.55, -0.25], RightForeArm: [-2.05, 0, 0], RightHand: [0.3, 0, 0], Neck: [0.12, 0.12, 0.08], LeftArm: [0.05, 0, 0.12] }));

  // Rifle shouldered: right hand at the wrist of the stock, left hand along the forend, cheek down.
  const RIFLE = { RightArm: [-1.05, 0.6, 0.15], RightForeArm: [-1.0, 0, 0], RightHand: [0.15, 0.2, 0], LeftArm: [-1.3, -0.55, 0], LeftForeArm: [-0.45, 0, 0], Spine2: [0, 0.3, 0], Neck: [0.12, -0.3, 0.1] } as const;
  const rifle = clip("ShootRifle", 0.7, {
    ...hold(RIFLE, 0.7),
    Spine2: [[0, ...RIFLE.Spine2], [0.06, -0.08, 0.3, 0], [0.7, ...RIFLE.Spine2]],
    RightArm: [[0, ...RIFLE.RightArm], [0.06, -1.2, 0.6, 0.15], [0.7, ...RIFLE.RightArm]],
  });

  // Dodge: a quick sidestep crouch, body leaning away.
  const dodge = clip(
    "Dodge",
    0.8,
    pose(0.8, 0.18, { Spine: [0.25, 0, 0.45], Spine2: [0, 0, 0.2], LeftUpLeg: [-0.6, 0, 0.35], LeftLeg: [0.9, 0, 0], RightUpLeg: [-0.2, 0, 0.2], RightLeg: [0.4, 0, 0], LeftArm: [0, 0, 0.9], RightArm: [-0.4, 0, -0.6] }),
    [[0, 0, 0, 0], [0.18, 0.12, -0.22, 0], [0.62, 0.12, -0.22, 0], [0.8, 0, 0, 0]],
  );

  // Crouch behind cover (held until the next view), gun up.
  const crouchPose = { Spine: [0.35, 0, 0], LeftUpLeg: [-1.45, 0, 0.15], RightUpLeg: [-1.1, 0, -0.15], LeftLeg: [2.1, 0, 0], RightLeg: [1.8, 0, 0], LeftFoot: [-0.6, 0, 0], RightFoot: [-0.6, 0, 0], RightArm: [-1.2, 0.3, 0], RightForeArm: [-0.6, 0, 0], LeftArm: [-0.3, 0, 0.3] } as const;
  const crouch = clip("CoverCrouch", 0.5, pose(0.5, 0.3, crouchPose, true), [[0, 0, 0, 0], [0.3, 0, -0.5, -0.05], [0.5, 0, -0.5, -0.05]]);

  // Death_B: spun round by the hit, falling forward and to the side.
  const deathB = clip(
    "Death_B",
    1.5,
    {
      Spine: [[0, 0, 0, 0], [0.35, 0.3, -0.5, 0], [1.5, 0.2, -0.3, 0.2]],
      Neck: [[0, 0, 0, 0], [0.5, 0.3, 0, 0], [1.5, 0.4, -0.6, 0]],
      Hips: [[0, 0, 0, 0], [0.35, 0.2, -0.8, 0], [1.0, 0.9, -1.2, 0.3], [1.5, 1.45, -1.3, 0.2]],
      LeftUpLeg: [[0, 0, 0, 0], [0.4, -0.5, 0, 0], [1.5, -0.2, 0, 0.3]],
      RightUpLeg: [[0, 0, 0, 0], [0.4, 0.1, 0, 0], [1.5, -0.6, 0, -0.2]],
      LeftLeg: [[0, 0, 0, 0], [0.4, 0.8, 0, 0], [1.5, 0.4, 0, 0]],
      RightLeg: [[0, 0, 0, 0], [0.4, 0.4, 0, 0], [1.5, 1.0, 0, 0]],
      LeftArm: [[0, 0, 0, 0.08], [0.6, -1.0, 0, 0.6], [1.5, -2.6, 0, 0.6]],
      RightArm: [[0, 0, 0, -0.08], [0.6, -0.6, 0, -0.9], [1.5, -0.2, 0, -1.4]],
    },
    [[0, 0, 0, 0], [0.35, 0, -0.25, 0.05], [1.0, 0, -0.65, 0.35], [1.5, 0, -0.82, 0.55]],
  );

  // Drink from a bottle: arm up, head back, then down again.
  const drink = clip("Drink", 1.4, pose(1.4, 0.35, { RightArm: [-1.25, 0.55, -0.35], RightForeArm: [-2.1, 0, 0], RightHand: [0.4, 0, 0], Neck: [-0.4, 0, 0], Spine2: [-0.1, 0, 0] }));

  // Cheer: both arms thrown up, a little hop.
  const cheer = clip(
    "Cheer",
    1.2,
    {
      LeftArm: [[0, 0, 0, 0.08], [0.2, 0, 0, 2.6], [0.5, 0, 0, 2.3], [0.8, 0, 0, 2.7], [1.2, 0, 0, 0.08]],
      RightArm: [[0, 0, 0, -0.08], [0.2, 0, 0, -2.6], [0.5, 0, 0, -2.3], [0.8, 0, 0, -2.7], [1.2, 0, 0, -0.08]],
      LeftForeArm: [[0, 0, 0, 0], [0.2, 0, 0, 0.4], [1.2, 0, 0, 0]],
      RightForeArm: [[0, 0, 0, 0], [0.2, 0, 0, -0.4], [1.2, 0, 0, 0]],
      Neck: [[0, 0, 0, 0], [0.3, -0.25, 0, 0], [1.2, 0, 0, 0]],
    },
    [[0, 0, 0, 0], [0.25, 0, 0.12, 0], [0.45, 0, 0, 0], [0.7, 0, 0.1, 0], [0.9, 0, 0, 0], [1.2, 0, 0, 0]],
  );

  // Throw: wind up behind the head, release forward, follow through.
  const toss = clip("Throw", 1.0, {
    RightArm: [[0, 0, 0, -0.08], [0.35, 0.6, 0, -2.4], [0.55, -1.6, 0, -0.4], [1.0, 0, 0, -0.08]],
    RightForeArm: [[0, 0, 0, 0], [0.35, -1.6, 0, 0], [0.55, -0.2, 0, 0], [1.0, 0, 0, 0]],
    Spine2: [[0, 0, 0, 0], [0.35, -0.15, -0.35, 0], [0.55, 0.15, 0.3, 0], [1.0, 0, 0, 0]],
    LeftArm: [[0, 0, 0, 0.08], [0.35, -0.8, 0, 0.3], [1.0, 0, 0, 0.08]],
  });

  // Grab: reach out with both hands, then pull back in.
  const grab = clip("Grab", 1.0, pose(1.0, 0.3, { LeftArm: [-1.3, -0.2, 0.1], RightArm: [-1.3, 0.2, -0.1], LeftForeArm: [-0.3, 0, 0], RightForeArm: [-0.3, 0, 0], Spine: [0.3, 0, 0] }));

  // Lasso: arm overhead twirling (held, the rope is an effect).
  const twirl: Key[] = Array.from({ length: 9 }, (_, i) => [i * 0.15, -0.3 + 0.25 * Math.sin(i * 1.6), 0.4 * Math.cos(i * 1.6), -2.7] as Key);
  twirl.unshift([0, 0, 0, -0.08]);
  for (let i = 1; i < twirl.length; i++) (twirl[i] as [number, number, number, number])[0] = 0.2 + (i - 1) * 0.15;
  const lasso = clip("Lasso", 1.4, { RightArm: twirl, RightForeArm: [[0, 0, 0, 0], [0.2, -0.6, 0, 0], [1.4, -0.6, 0, 0]], Spine2: [[0, 0, 0, 0], [0.3, 0, -0.2, 0], [1.4, 0, -0.2, 0]] });

  // Sit on the jail floor, forearms on the knees (held).
  const sit = clip(
    "SitJail",
    0.8,
    pose(0.8, 0.6, { Spine: [0.5, 0, 0], LeftUpLeg: [-1.55, 0, 0.25], RightUpLeg: [-1.55, 0, -0.25], LeftLeg: [2.2, 0, 0], RightLeg: [2.2, 0, 0], LeftArm: [-0.9, 0, 0.2], RightArm: [-0.9, 0, -0.2], LeftForeArm: [-0.6, 0, 0], RightForeArm: [-0.6, 0, 0], Neck: [0.35, 0, 0] }, true),
    [[0, 0, 0, 0], [0.6, 0, -0.72, -0.15], [0.8, 0, -0.72, -0.15]],
  );

  // Taunt: hands on hips, chin up, a slow head shake.
  const taunt = clip("Taunt", 1.6, {
    ...pose(1.6, 0.3, { LeftArm: [0.25, 0, 0.75], RightArm: [0.25, 0, -0.75], LeftForeArm: [-1.6, 0.6, 0], RightForeArm: [-1.6, -0.6, 0], Spine2: [-0.1, 0, 0] }),
    Neck: [[0, 0, 0, 0], [0.4, -0.2, 0.3, 0], [0.8, -0.2, -0.3, 0], [1.2, -0.2, 0.3, 0], [1.6, 0, 0, 0]],
  });

  // Shrug: shoulders up, palms out.
  const shrug = clip("Shrug", 1.0, pose(1.0, 0.25, { LeftShoulder: [0, 0, 0.25], RightShoulder: [0, 0, -0.25], LeftArm: [0, 0, 0.35], RightArm: [0, 0, -0.35], LeftForeArm: [-1.2, -0.5, 0], RightForeArm: [-1.2, 0.5, 0], Neck: [0, 0, 0.2] }));

  // Ride: seated in the saddle, legs apart around the horse, reins in the left hand (held, a loop).
  const ride = clip("Ride", 1, hold({ LeftUpLeg: [-1.25, 0, 0.45], RightUpLeg: [-1.25, 0, -0.45], LeftLeg: [1.3, 0, 0], RightLeg: [1.3, 0, 0], LeftArm: [-0.9, 0, 0.1], LeftForeArm: [-0.8, 0, 0], RightArm: AIM.RightArm as readonly [number, number, number], Spine: [0.2, 0, 0] }, 1));
  void AIM;
  return [think, rifle, dodge, crouch, deathB, drink, cheer, toss, grab, lasso, sit, taunt, shrug, ride];
}
