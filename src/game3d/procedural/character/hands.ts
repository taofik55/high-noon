import { Quaternion, Vector3 } from "three";
import type { PartList } from "../core/parts";
import { sweep } from "../core/sweep";
import { BONE, rest } from "./skeleton";
import { chainSkin } from "./skin";
import type { CharacterSpec } from "./spec";

/**
 * Hands: a palm loft plus four jointed fingers and a thumb, relaxed and half curled (the same pose holds a revolver
 * grip). Built in a local hand frame, then placed at the wrist: down the forearm, palm facing the thigh.
 */
export function buildHands(parts: PartList, spec: CharacterSpec): void {
  for (const side of [1, -1] as const) {
    const sideName = side === 1 ? "Left" : "Right";
    const wrist = rest(`${sideName}Hand`);
    const elbow = rest(`${sideName}ForeArm`);
    // Hand frame: d = down the hand, t = toward the thumb (forward), n = out of the back of the hand.
    const d = wrist.clone().sub(elbow).normalize();
    const t = new Vector3(0, 0, 1).addScaledVector(d, -d.z).normalize();
    const n = new Vector3().crossVectors(d, t).multiplyScalar(side);
    const at = (along: number, toward: number, out: number) =>
      wrist.clone().addScaledVector(d, along).addScaledVector(t, toward).addScaledVector(n, out);

    const palm = sweep({
      path: [at(-0.005, 0.0, 0.0), at(0.03, 0.0, 0.0), at(0.07, -0.002, 0.001), at(0.092, -0.003, 0.0)],
      rings: [
        { w: 0.022, f: 0.026, b: 0.024 },
        { w: 0.019, f: 0.04, b: 0.036, p: 2.6 },
        { w: 0.016, f: 0.043, b: 0.038, p: 2.8 },
        { w: 0.013, f: 0.04, b: 0.036, p: 2.6 },
      ],
      front: t,
      radial: 14,
      samples: 7,
    });
    // `w` is the hand's thickness here (front = thumb side), so the palm reads flat.
    parts.add(palm.geometry, {
      material: "skin",
      color: spec.palette.skin,
      skin: chainSkin(palm.along, [
        { bone: BONE[`${sideName}ForeArm`], from: 0 },
        { bone: BONE[`${sideName}Hand`], from: 0.15 },
      ]),
    });

    // Fingers: index → little, spaced across the knuckles, each a three-segment curl toward the palm.
    const fingers = [
      { toward: 0.025, len: [0.042, 0.026, 0.02], r: 0.0095 },
      { toward: 0.008, len: [0.046, 0.029, 0.021], r: 0.0098 },
      { toward: -0.009, len: [0.043, 0.027, 0.02], r: 0.0092 },
      { toward: -0.024, len: [0.034, 0.021, 0.018], r: 0.0082 },
    ];
    // Relaxed curl, a little more toward the little finger, the way a hand hangs.
    const curl = [0.5, 0.8, 0.6];
    for (const f of fingers) {
      const pts = [at(0.084, f.toward, 0.0)];
      let dir = d.clone();
      const axis = t.clone().multiplyScalar(side);
      for (let i = 0; i < 3; i++) {
        dir = dir.clone().applyQuaternion(new Quaternion().setFromAxisAngle(axis, -(curl[i] as number)));
        pts.push((pts[i] as Vector3).clone().addScaledVector(dir, f.len[i] as number));
      }
      const finger = sweep({
        path: pts,
        rings: [
          { w: f.r * 1.05, f: f.r, b: f.r },
          { w: f.r * 0.95, f: f.r * 0.9, b: f.r * 0.9 },
          { w: f.r * 0.85, f: f.r * 0.8, b: f.r * 0.8 },
          { w: f.r * 0.6, f: f.r * 0.62, b: f.r * 0.6 },
        ],
        front: t,
        radial: 8,
        samples: 8,
        capEnd: true,
      });
      parts.add(finger.geometry, { material: "skin", color: spec.palette.skin, bone: BONE[`${sideName}Hand`] });
    }

    // Thumb: from the heel of the palm, forward and down, curling in.
    const base = at(0.02, 0.03, -0.004);
    const tdir = d.clone().multiplyScalar(0.6).addScaledVector(t, 0.75).addScaledVector(n, -0.25).normalize();
    const p1 = base.clone().addScaledVector(tdir, 0.035);
    const tdir2 = tdir.clone().addScaledVector(n, -0.5).addScaledVector(d, 0.3).normalize();
    const p2 = p1.clone().addScaledVector(tdir2, 0.028);
    const p3 = p2.clone().addScaledVector(tdir2.clone().addScaledVector(n, -0.4).normalize(), 0.022);
    const thumb = sweep({
      path: [base, p1, p2, p3],
      rings: [
        { w: 0.016, f: 0.015, b: 0.015 },
        { w: 0.012, f: 0.011, b: 0.011 },
        { w: 0.0105, f: 0.0098, b: 0.0098 },
        { w: 0.007, f: 0.007, b: 0.007 },
      ],
      front: n,
      radial: 8,
      samples: 8,
      capEnd: true,
    });
    parts.add(thumb.geometry, { material: "skin", color: spec.palette.skin, bone: BONE[`${sideName}Hand`] });
  }
}
