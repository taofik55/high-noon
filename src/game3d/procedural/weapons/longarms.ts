import { Path, Shape, type BufferGeometry } from "three";
import { PartList } from "../core/parts";
import { extrude, lathe, mat, polygon } from "../core/shapes";
import { addRevolver } from "./colt45";

/**
 * Lever actions (Volcanic pistol, Winchester rifle) and the revolving carabine. Same conventions as the revolver:
 * side profiles drawn with x = forward, y = up and extruded across; round parts lathed along the bore (octagonal
 * barrels are lathes with 8 sides). Final frame: muzzle toward +Z, origin where the right hand holds it.
 */

const BRASS = "#c09a4e";
const BLUED = "#2e333c";
const WALNUT = "#5a3420";

/** Profile point (x forward, y up) → final frame around a hand position. */
const at = (hand: readonly [number, number]) => (x = 0, y = 0, side = 0) => mat([side, y - hand[1], x - hand[0]], [0, -Math.PI / 2, 0]);
const along = (hand: readonly [number, number]) => (x: number, y: number, side = 0) => mat([side, y - hand[1], x - hand[0]], [Math.PI / 2, 0, 0]);

function octBarrel(length: number, r: number): BufferGeometry {
  // Eight-sided, with a crowned muzzle and a short bore.
  return lathe(
    [
      [r * 0.42, 0],
      [r, 0],
      [r, length - 0.004],
      [r * 0.9, length],
      [r * 0.48, length + 0.0005],
      [r * 0.42, length - 0.012],
    ],
    8,
    Math.PI / 8,
  );
}

function leverLoop(scale: number): Shape {
  // Lever with a finger loop below the receiver.
  const s = new Shape();
  s.moveTo(0.02 * scale, 0);
  s.lineTo(0.03 * scale, -0.012 * scale);
  s.bezierCurveTo(0.03 * scale, -0.04 * scale, -0.01 * scale, -0.07 * scale, -0.05 * scale, -0.06 * scale);
  s.bezierCurveTo(-0.075 * scale, -0.05 * scale, -0.07 * scale, -0.025 * scale, -0.045 * scale, -0.018 * scale);
  s.lineTo(-0.02 * scale, -0.01 * scale);
  s.lineTo(-0.012 * scale, 0);
  s.closePath();
  const hole = new Path();
  hole.moveTo(-0.025 * scale, -0.025 * scale);
  hole.bezierCurveTo(-0.01 * scale, -0.05 * scale, 0.015 * scale, -0.035 * scale, 0.016 * scale, -0.016 * scale);
  hole.bezierCurveTo(0.0, -0.03 * scale, -0.04 * scale, -0.055 * scale, -0.055 * scale, -0.045 * scale);
  hole.bezierCurveTo(-0.06 * scale, -0.035 * scale, -0.045 * scale, -0.028 * scale, -0.025 * scale, -0.025 * scale);
  s.holes.push(hole);
  return s;
}

function stockShape(len: number, drop: number): Shape {
  // From the receiver's back: wrist, comb, then a crescent butt.
  const s = new Shape();
  s.moveTo(0, 0.03);
  s.lineTo(0, -0.012);
  s.bezierCurveTo(-0.05, -0.03, -0.09, -0.035, -0.12, -0.04);
  s.lineTo(-len, -0.06 - drop);
  s.quadraticCurveTo(-len - 0.012, -0.0 - drop * 0.5, -len + 0.004, 0.05 - drop * 0.3);
  s.lineTo(-0.11, 0.028);
  s.quadraticCurveTo(-0.05, 0.02, 0, 0.03);
  return s;
}

export function leverActionGeometry(kind: "volcanic" | "winchester"): Map<string, BufferGeometry> {
  const rifle = kind === "winchester";
  const parts = new PartList({ skinned: false });
  // Hand: on the grip (pistol) or the wrist of the stock (rifle).
  const hand = rifle ? ([-0.07, -0.02] as const) : ([-0.04, -0.045] as const);
  const P = at(hand);
  const B = along(hand);
  const recLen = rifle ? 0.15 : 0.085;
  const recH = rifle ? 0.05 : 0.036;
  // Receiver: a brass side plate with a rounded nose and a loading gate.
  const rec = new Shape();
  rec.moveTo(-0.02, 0);
  rec.lineTo(recLen - 0.01, 0);
  rec.quadraticCurveTo(recLen, 0.004, recLen, recH * 0.45);
  rec.lineTo(recLen, recH);
  rec.lineTo(0.0, recH);
  rec.quadraticCurveTo(-0.022, recH, -0.024, recH * 0.55);
  rec.closePath();
  parts.add(extrude(rec, rifle ? 0.034 : 0.024, { size: 0.0018 }), { material: "brass", color: BRASS, matrix: P(0, 0) });
  if (rifle) parts.add(extrude(polygon([[0, 0], [0.045, 0], [0.045, 0.014], [0.004, 0.016]]), 0.002), { material: "steel", color: BLUED, matrix: P(0.06, 0.012, -0.0185) });
  // Barrel and magazine tube.
  const L = rifle ? 0.6 : 0.15;
  const barrelY = recH * 0.72;
  parts.add(octBarrel(L, rifle ? 0.011 : 0.0085), { material: "steel", color: BLUED, matrix: B(recLen - 0.004, barrelY) });
  parts.add(lathe([[0, 0], [rifle ? 0.008 : 0.0065, 0], [rifle ? 0.008 : 0.0065, L * 0.92], [0.005, L * 0.93], [0, L * 0.93]], 12), { material: "steel", color: BLUED, matrix: B(recLen - 0.004, barrelY - (rifle ? 0.02 : 0.016)) });
  // Front sight and, on the rifle, barrel bands and a rear sight.
  parts.add(extrude(polygon([[0, 0], [0.014, 0], [0.012, 0.007], [0.004, 0.007]]), 0.003), { material: "steel", color: BLUED, matrix: P(recLen + L - 0.03, barrelY + (rifle ? 0.011 : 0.0085)) });
  if (rifle) {
    for (const x of [0.2, 0.44]) parts.add(lathe([[0.0125, 0], [0.0135, 0], [0.0135, 0.012], [0.0125, 0.012]], 12), { material: "steel", color: BLUED, matrix: B(recLen + x, barrelY - 0.01) });
    parts.add(extrude(polygon([[0, 0], [0.024, 0], [0.022, 0.012], [0.016, 0.009], [0.008, 0.009], [0.002, 0.012]]), 0.008), { material: "steel", color: BLUED, matrix: P(recLen + 0.06, barrelY + 0.011) });
    // Walnut forend under the barrel.
    const fore = new Shape();
    fore.moveTo(0, -0.014);
    fore.lineTo(0.24, -0.012);
    fore.quadraticCurveTo(0.255, -0.004, 0.24, 0.008);
    fore.lineTo(0, 0.008);
    fore.closePath();
    parts.add(extrude(fore, 0.03, { size: 0.004, thickness: 0.004 }), { material: "wood", color: WALNUT, matrix: P(recLen + 0.005, barrelY - 0.016) });
    // Stock with a steel crescent buttplate.
    parts.add(extrude(stockShape(0.3, 0.02), 0.036, { size: 0.006, thickness: 0.006, segments: 3 }, 12), { material: "wood", color: WALNUT, matrix: P(-0.024, recH * 0.5) });
    parts.add(extrude(polygon([[0, -0.08], [0.008, -0.08], [0.012, 0.03], [0.002, 0.034], [-0.004, 0.0]]), 0.038, { size: 0.001 }), { material: "steel", color: BLUED, matrix: P(-0.33, recH * 0.5 + 0.0) });
  } else {
    // Volcanic: bird's-head grip.
    const grip = new Shape();
    grip.moveTo(-0.02, 0.004);
    grip.bezierCurveTo(-0.026, -0.03, -0.03, -0.06, -0.026, -0.085);
    grip.quadraticCurveTo(-0.04, -0.1, -0.058, -0.088);
    grip.bezierCurveTo(-0.07, -0.06, -0.05, -0.02, -0.038, 0.008);
    grip.closePath();
    parts.add(extrude(grip, 0.028, { size: 0.004, thickness: 0.004, segments: 3 }, 10), { material: "wood", color: WALNUT, matrix: P(0, 0) });
  }
  // Lever, trigger and hammer.
  parts.add(extrude(leverLoop(rifle ? 1.1 : 0.85), 0.007, { size: 0.0012 }, 10), { material: "steel", color: BLUED, matrix: P(rifle ? 0.02 : 0.01, 0.002) });
  const trigger = polygon([[0.002, -0.002], [0.006, -0.012], [0.0, -0.02], [-0.003, -0.018], [0.0, -0.01], [-0.003, -0.002]]);
  parts.add(extrude(trigger, 0.004, { size: 0.0006 }), { material: "steel", color: BLUED, matrix: P(rifle ? -0.004 : -0.006, 0) });
  const hammer = polygon([[-0.004, recH * 0.6], [-0.01, recH + 0.012], [-0.022, recH + 0.016], [-0.02, recH + 0.008], [-0.014, recH * 0.55]]);
  parts.add(extrude(hammer, 0.007, { size: 0.0008 }), { material: "steel", color: BLUED, matrix: P(0, 0) });
  return parts.build();
}

/** Revolving carabine: a Colt action with a long barrel, a forend and a shoulder stock. */
export function carabineGeometry(): Map<string, BufferGeometry> {
  const parts = new PartList({ skinned: false });
  // Revolver frame placed so that the stock wrist sits at the hand position.
  const base = mat([0, 0.02, 0.08]);
  addRevolver(parts, { barrel: 0.42, steel: BLUED, frame: "#6e6458", grip: WALNUT, guard: BRASS, guardKey: "brass", gripless: true }, base);
  // In the revolver's profile space the frame's back is at x ≈ -0.026, y ≈ 0.026 (above the grip origin).
  const P = (x: number, y: number, side = 0) => base.clone().multiply(mat([side, y + 0.045, x + 0.036], [0, -Math.PI / 2, 0]));
  parts.add(extrude(stockShape(0.32, 0.035), 0.034, { size: 0.006, thickness: 0.006, segments: 3 }, 12), { material: "wood", color: WALNUT, matrix: P(-0.024, 0.01) });
  parts.add(extrude(polygon([[0, -0.1], [0.008, -0.1], [0.012, 0.03], [0.002, 0.034], [-0.004, -0.01]]), 0.036, { size: 0.001 }), { material: "steel", color: BLUED, matrix: P(-0.35, 0.01) });
  const fore = new Shape();
  fore.moveTo(0, -0.012);
  fore.lineTo(0.2, -0.01);
  fore.quadraticCurveTo(0.212, -0.002, 0.2, 0.008);
  fore.lineTo(0, 0.008);
  fore.closePath();
  parts.add(extrude(fore, 0.026, { size: 0.004, thickness: 0.004 }), { material: "wood", color: WALNUT, matrix: P(0.11, 0.012) });
  return parts.build();
}
