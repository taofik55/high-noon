import { Color, Shape, Vector3 } from "three";
import type { PartList } from "../core/parts";
import { extrude, lathe, mat, roundedRect } from "../core/shapes";
import { sweep } from "../core/sweep";
import { BONE } from "./skeleton";
import type { CharacterSpec } from "./spec";

/** Holster centre line (model space). */
const HOLSTER = [-0.205, 0.85, 0.035] as const;
/**
 * Where the holstered revolver's grip centre sits (model space) and how it is turned: barrel down into the holster
 * (gun +Z → -Y), grip back, tilted with the holster.
 */
export const HOLSTER_SOCKET = { position: [HOLSTER[0], 0.928, HOLSTER[2] - 0.062] as const, rotation: [Math.PI / 2 + 0.1, 0, -0.12] as const };

const ellipse = (cx: number, cy: number, cz: number, rx: number, rz: number, n: number, tiltY = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    // Tilt: one side lower than the other (a gun belt riding down on the holster side).
    return new Vector3(cx + Math.cos(a) * rx, cy + tiltY * Math.cos(a), cz + Math.sin(a) * rz);
  });

export function buildGear(parts: PartList, spec: CharacterSpec): void {
  // A saloon singer's dress has no gun belt (her derringer stays out of sight).
  if (spec.coat === "dress") return;
  const k = spec.bulk;
  const leather = spec.palette.belt;

  // Trouser belt with a brass buckle.
  const beltPath = ellipse(0, 0.995, -0.003, 0.162 * k, 0.106 * k, 28);
  const belt = sweep({ path: beltPath, rings: beltPath.map(() => ({ w: 0.004, f: 0.017, b: 0.017, p: 4 })), front: new Vector3(0, 1, 0), radial: 8, closed: true });
  parts.add(belt.geometry, { material: "leather", color: new Color(leather).multiplyScalar(0.8), bone: BONE.Hips });
  const buckle = roundedRect(0.05, 0.038, 0.008);
  buckle.holes.push(roundedRect(0.032, 0.022, 0.004) as unknown as Shape);
  parts.add(extrude(buckle, 0.005, { size: 0.0012 }), { material: "brass", color: spec.palette.metal, bone: BONE.Hips, matrix: mat([0, 0.995, 0.106 * k + 0.003]) });

  // Gun belt: wider, slung low on the right where the holster hangs, with a row of cartridges.
  const gunPath = ellipse(0, 0.948, 0.0, 0.17 * k, 0.118 * k, 32, 0.028);
  const gunBelt = sweep({ path: gunPath, rings: gunPath.map(() => ({ w: 0.005, f: 0.026, b: 0.026, p: 4 })), front: new Vector3(0, 1, 0), radial: 8, closed: true });
  parts.add(gunBelt.geometry, { material: "leather", color: leather, bone: BONE.Hips });
  const cartridge = lathe(
    [
      [0, -0.013],
      [0.0042, -0.013],
      [0.0042, 0.006],
      [0.0036, 0.009],
      [0.0024, 0.0125],
      [0, 0.0135],
    ],
    6,
  );
  for (let i = 0; i < 14; i++) {
    // Along the left hip and back, where nothing else hangs.
    const a = 0.25 + (i / 13) * 2.6;
    const x = Math.cos(a) * (0.17 * k + 0.007);
    const z = -Math.sin(a) * (0.118 * k + 0.007);
    const y = 0.948 + 0.028 * Math.cos(a);
    parts.add(cartridge, { material: "brass", color: spec.palette.metal, bone: BONE.Hips, matrix: mat([x, y + 0.002, z]) });
  }

  // Holster: a tapered pouch with a welt seam, angled out from the right thigh (and a mirrored one on the left for
  // two-gun characters).
  const holster = new Shape();
  holster.moveTo(-0.028, 0.06);
  holster.quadraticCurveTo(-0.03, 0.0, -0.022, -0.1);
  holster.quadraticCurveTo(-0.018, -0.135, 0.0, -0.14);
  holster.quadraticCurveTo(0.02, -0.135, 0.024, -0.1);
  holster.quadraticCurveTo(0.034, 0.0, 0.04, 0.05);
  holster.quadraticCurveTo(0.018, 0.075, -0.028, 0.06);
  const [hx, hy, hz] = HOLSTER;
  const pouch = extrude(holster, 0.038, { size: 0.006, thickness: 0.008, segments: 3 });
  const welt = extrude(roundedRect(0.012, 0.19, 0.005, 0.0, -0.04), 0.046, { size: 0.0015 });
  const tiePath = ellipse(-0.1, 0.735, 0.012, 0.078 * k, 0.078 * k, 18);
  const tie = sweep({ path: tiePath, rings: tiePath.map(() => ({ w: 0.003, f: 0.006, b: 0.006, p: 3 })), front: new Vector3(0, 1, 0), radial: 6, closed: true });
  for (const side of spec.twoGuns ? [1, -1] : [1]) {
    const mirror = mat([0, 0, 0], [0, 0, 0], [side, 1, 1]);
    const holsterM = mirror.clone().multiply(mat([hx - 0.002, hy - 0.035, hz], [0.1, Math.PI / 2, -0.12]));
    parts.add(pouch, { material: "leather", color: new Color(leather).multiplyScalar(0.9), bone: BONE.Hips, matrix: holsterM });
    parts.add(welt, { material: "leather", color: new Color(leather).multiplyScalar(0.7), bone: BONE.Hips, matrix: holsterM.clone().multiply(mat([0.03, 0, 0])) });
    parts.add(tie.geometry, { material: "leather", color: new Color(leather).multiplyScalar(0.75), bone: side === 1 ? BONE.RightUpLeg : BONE.LeftUpLeg, matrix: mirror });
  }
}
