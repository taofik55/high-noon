import { Color, Group, Mesh, Path, Shape, type BufferGeometry } from "three";
import { PartList, triangleCount } from "../core/parts";
import { extrude, lathe, mat, polygon } from "../core/shapes";
import { isMaterialKey, material } from "../materials";

/**
 * Colt Single Action Army (.45, 5½" barrel). Side-profile pieces (frame, hammer, trigger, guard, grip) are drawn as
 * outlines with X = forward, Y = up and extruded across the gun; round pieces (barrel, ejector housing, cylinder) are
 * lathed or extruded along the bore. Final frame: muzzle toward +Z, top +Y, origin in the middle of the grip where
 * the hand holds it. About 0.28 m long.
 */

const BLUED = "#3a4150";
const CASE = "#7a6e62";
const WOOD = "#5a3420";
const BRASS = "#b48a48";

/** Profile coordinates (x forward, y up) → final frame, around the grip centre. */
const GRIP = [-0.036, -0.045] as const;
const profile = (x = 0, y = 0, side = 0, rotZ = 0) => mat([side, y - GRIP[1], x - GRIP[0]], [0, -Math.PI / 2, 0]).multiply(mat([0, 0, 0], [0, 0, rotZ]));

const geometryCache: { value: Map<string, BufferGeometry> | null } = { value: null };

function buildParts(): Map<string, BufferGeometry> {
  const parts = new PartList({ skinned: false });
  const P = (g: BufferGeometry, mat: string, color: string, x = 0, y = 0, side = 0, colorAt?: Parameters<PartList["add"]>[1]["colorAt"]) =>
    parts.add(g, { material: mat, color, matrix: profile(x, y, side), colorAt });

  // Frame with the cylinder window; case-hardened mottling painted per vertex.
  const frame = polygon([
    [-0.026, 0.026],
    [-0.016, 0.044],
    [-0.006, 0.0475],
    [0.064, 0.0475],
    [0.066, 0.04],
    [0.066, 0.016],
    [0.058, 0.01],
    [0.032, 0.0],
    [0.012, -0.004],
    [-0.008, -0.004],
    [-0.022, 0.006],
  ]);
  const window = new Path();
  window.moveTo(0.009, 0.006);
  window.lineTo(0.053, 0.006);
  window.lineTo(0.053, 0.041);
  window.lineTo(0.009, 0.041);
  window.closePath();
  frame.holes.push(window);
  const frameGeo = extrude(frame, 0.022, { size: 0.0015, thickness: 0.0015 });
  const fp = frameGeo.getAttribute("position");
  const mottle = new Color("#3d4a5c");
  const straw = new Color("#8a6a45");
  P(frameGeo, "steel", CASE, 0, 0, 0, (v, base, out) => {
    const n = Math.sin(fp.getX(v) * 310) * Math.cos(fp.getY(v) * 270) + Math.sin(fp.getZ(v) * 900);
    out.copy(base).lerp(n > 0.6 ? mottle : straw, Math.min(0.55, Math.abs(n) * 0.3));
  });
  // Top strap groove (rear sight) and the recoil shield's rounded back.
  P(extrude(polygon([[-0.004, 0], [0.05, 0], [0.05, 0.002], [-0.004, 0.002]]), 0.006), "steel", BLUED, 0, 0.0475);

  // Cylinder: fluted outline with six chambers, extruded along the bore.
  const cyl = new Shape();
  const R = 0.0178;
  const steps = 72;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const flute = Math.max(0, Math.cos(6 * (a + Math.PI / 6))) ** 6;
    const r = R - 0.0042 * flute;
    if (i === 0) cyl.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else cyl.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  for (let c = 0; c < 6; c++) {
    const a = (c / 6) * Math.PI * 2 + Math.PI / 2;
    const hole = new Path();
    hole.absarc(Math.cos(a) * 0.0108, Math.sin(a) * 0.0108, 0.0039, 0, Math.PI * 2, true);
    cyl.holes.push(hole);
  }
  const cylinder = extrude(cyl, 0.04, { size: 0.0012, thickness: 0.0012 }, 6);
  parts.add(cylinder, { material: "steel", color: BLUED, matrix: mat([0, 0.0235 - GRIP[1], 0.031 - GRIP[0]]) });
  // Cartridge rims showing at the back of the cylinder.
  for (let c = 0; c < 6; c++) {
    const a = (c / 6) * Math.PI * 2 + Math.PI / 2;
    const rim = lathe([[0, 0], [0.0042, 0], [0.0043, 0.0012], [0, 0.0012]], 8);
    parts.add(rim, { material: "brass", color: BRASS, matrix: mat([Math.cos(a) * 0.0108, 0.0235 - GRIP[1] + Math.sin(a) * 0.0108, 0.0105 - GRIP[0]], [Math.PI / 2, 0, 0]) });
  }

  // Barrel: lathed with a stepped shank, a crowned muzzle and a short visible bore.
  const barrel = lathe(
    [
      [0.0036, 0.0],
      [0.0098, 0.0],
      [0.0098, 0.009],
      [0.0082, 0.012],
      [0.0078, 0.138],
      [0.0072, 0.142],
      [0.0042, 0.1425],
      [0.0036, 0.13],
    ],
    20,
  );
  parts.add(barrel, { material: "steel", color: BLUED, matrix: mat([0, 0.035 - GRIP[1], 0.064 - GRIP[0]], [Math.PI / 2, 0, 0]) });
  // Front sight blade.
  P(extrude(polygon([[0, 0], [0.012, 0], [0.01, 0.006], [0.004, 0.006]]), 0.0025), "steel", BLUED, 0.19, 0.0425);
  // Ejector rod housing under the barrel, with its lug and the rod's crescent head.
  const housing = lathe([[0, 0], [0.0047, 0], [0.0047, 0.075], [0.004, 0.08], [0, 0.08]], 12);
  parts.add(housing, { material: "steel", color: BLUED, matrix: mat([0.0055, 0.0225 - GRIP[1], 0.066 - GRIP[0]], [Math.PI / 2, 0, 0]) });
  P(extrude(polygon([[0, 0], [0.012, 0.004], [0.012, 0.011], [0, 0.011]]), 0.007, { size: 0.0008 }), "steel", BLUED, 0.128, 0.022, 0.003);
  const head = lathe([[0, 0], [0.0045, 0], [0.005, 0.003], [0.003, 0.006], [0, 0.006]], 10);
  parts.add(head, { material: "steel", color: BLUED, matrix: mat([0.0055, 0.0225 - GRIP[1], 0.145 - GRIP[0]], [Math.PI / 2, 0, 0]) });
  // Base pin screw and loading gate on the right side.
  P(lathe([[0, 0], [0.0035, 0], [0.0035, 0.002], [0, 0.003]], 10), "steel", BLUED, 0.062, 0.019, 0.011);
  P(extrude(polygon([[0, 0], [0.012, 0], [0.012, 0.016], [0.002, 0.018]]), 0.003, { size: 0.0006 }), "steel", CASE, -0.002, 0.012, -0.0125);

  // Hammer with a checkered-looking spur (the ridges are geometry, not texture).
  const hammer = new Shape();
  hammer.moveTo(-0.004, 0.028);
  hammer.lineTo(-0.012, 0.05);
  hammer.quadraticCurveTo(-0.022, 0.066, -0.036, 0.064);
  hammer.lineTo(-0.034, 0.058);
  hammer.quadraticCurveTo(-0.024, 0.056, -0.02, 0.044);
  hammer.lineTo(-0.016, 0.026);
  hammer.closePath();
  P(extrude(hammer, 0.007, { size: 0.0008 }), "steel", CASE);
  for (let i = 0; i < 4; i++) P(extrude(polygon([[0, 0], [0.003, 0], [0.003, 0.0012], [0, 0.0012]]), 0.0075), "steel", BLUED, -0.034 + i * 0.0035, 0.064 - i * 0.0004, 0, undefined);

  // Trigger guard (a loop with a hole) and a curved trigger.
  const guard = new Shape();
  guard.moveTo(0.016, -0.004);
  guard.quadraticCurveTo(0.024, -0.03, 0.0, -0.032);
  guard.quadraticCurveTo(-0.02, -0.03, -0.022, -0.01);
  guard.lineTo(-0.016, -0.006);
  guard.quadraticCurveTo(-0.014, -0.024, 0.0, -0.025);
  guard.quadraticCurveTo(0.016, -0.024, 0.01, -0.004);
  guard.closePath();
  P(extrude(guard, 0.006, { size: 0.0012 }), "brass", BRASS);
  const trigger = new Shape();
  trigger.moveTo(0.002, -0.003);
  trigger.quadraticCurveTo(0.006, -0.014, 0.0, -0.022);
  trigger.lineTo(-0.003, -0.02);
  trigger.quadraticCurveTo(0.001, -0.013, -0.003, -0.003);
  trigger.closePath();
  P(extrude(trigger, 0.004, { size: 0.0006 }), "steel", CASE);

  // Plow-handle grip: slim at the frame, swelling and sweeping back to a rounded butt; walnut panels, a steel
  // backstrap following the rear curve, and grip screws.
  const grip = new Shape();
  grip.moveTo(-0.013, -0.003);
  grip.bezierCurveTo(-0.017, -0.032, -0.029, -0.07, -0.043, -0.097);
  grip.quadraticCurveTo(-0.056, -0.112, -0.07, -0.1);
  grip.bezierCurveTo(-0.071, -0.064, -0.058, -0.022, -0.033, 0.011);
  grip.lineTo(-0.022, 0.007);
  grip.closePath();
  P(extrude(grip, 0.031, { size: 0.0045, thickness: 0.004, segments: 3 }, 12), "wood", WOOD);
  const strap = new Shape();
  strap.moveTo(-0.033, 0.011);
  strap.bezierCurveTo(-0.058, -0.022, -0.071, -0.064, -0.07, -0.1);
  strap.lineTo(-0.0735, -0.099);
  strap.bezierCurveTo(-0.0745, -0.064, -0.061, -0.02, -0.036, 0.015);
  strap.closePath();
  P(extrude(strap, 0.014, { size: 0.001 }, 12), "steel", BLUED);
  const screw = lathe([[0, 0], [0.004, 0], [0.0042, 0.0012], [0, 0.0016]], 10);
  parts.add(screw, { material: "brass", color: BRASS, matrix: profile(-0.045, -0.05, 0.0198).multiply(mat([0, 0, 0], [0, 0, -Math.PI / 2])) });
  parts.add(screw, { material: "brass", color: BRASS, matrix: profile(-0.045, -0.05, -0.0198).multiply(mat([0, 0, 0], [0, 0, Math.PI / 2])) });

  return parts.build();
}

export function colt45Geometry(): Map<string, BufferGeometry> {
  geometryCache.value ??= buildParts();
  return geometryCache.value;
}

export function buildColt45(): { group: Group; triangles: number } {
  const group = new Group();
  group.name = "weapon.colt45";
  let triangles = 0;
  for (const [key, geometry] of colt45Geometry()) {
    if (!isMaterialKey(key)) continue;
    const mesh = new Mesh(geometry, material(key));
    mesh.castShadow = true;
    mesh.name = `colt45.${key}`;
    group.add(mesh);
    triangles += triangleCount(geometry);
  }
  return { group, triangles };
}
