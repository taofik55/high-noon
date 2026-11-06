import {
  BackSide,
  Color,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Path,
  PlaneGeometry,
  Shape,
  Vector3,
  type BufferGeometry,
  type ColorRepresentation,
} from "three";
import { InstanceSet } from "../core/instances";
import { PartList, triangleCount } from "../core/parts";
import { extrude, lathe, mat, polygon, roundedRect } from "../core/shapes";
import { bracketShape, cornice, plankGeometry, prototype, prototypeBox, signTexture, turnedProfile, type BuiltBuilding, type Opening } from "./kit";
import { isMaterialKey, material, type MaterialKey } from "../materials";

/**
 * The saloon (docs/05 §2): a two-storey clapboard building behind a tall false front with a stepped, arched
 * parapet, a boardwalk porch under a balcony on turned posts, batwing doors, cased windows with muntins and
 * shutters, a painted sign, a shingled gable roof with a stovepipe, and a few props. Front faces +Z, centred on x,
 * ground at y = 0, about 10 m wide.
 *
 * Repeated pieces (boards, balusters, brackets, shingles) are InstancedMeshes; everything else is merged per
 * material. The whole building is roughly a dozen draw calls.
 */

const PAINT = "#7a3b2a";
const TRIM = "#e2d3b0";
const RAW = "#8a6a4a";
const DARK = "#3a2a1e";
const STEEL = "#3a3a3a";

const W = 10;
const D = 9;
const FRONT = D / 2;
const DECK = 0.45;
const FLOOR2 = 3.6;
const EAVE = 6.4;
const PORCH = 2.6;

const FRONT_OPENINGS: Opening[] = [
  { x: 0, y: DECK, w: 1.7, h: 2.55, kind: "batwing" },
  { x: -2.9, y: DECK + 0.85, w: 1.15, h: 1.65, kind: "window" },
  { x: 2.9, y: DECK + 0.85, w: 1.15, h: 1.65, kind: "window" },
  { x: 0, y: FLOOR2 + 0.2, w: 1.05, h: 1.9, kind: "door" },
  { x: -2.9, y: FLOOR2 + 0.6, w: 1.0, h: 1.4, kind: "window" },
  { x: 2.9, y: FLOOR2 + 0.6, w: 1.0, h: 1.4, kind: "window" },
];

export function buildSaloon(): BuiltBuilding {
  const parts = new PartList({ skinned: false });
  const add = (g: BufferGeometry, key: MaterialKey, color: ColorRepresentation, m?: Matrix4) => parts.add(g, { material: key, color, matrix: m });

  const boards = new InstanceSet("saloon.boards", plankGeometry(), material("paint"));
  const deck = new InstanceSet("saloon.deck", plankGeometry(), material("wood"));
  const balusterGeo = prototype(lathe(turnedProfile(0.62, 0.028), 6));
  const balusters = new InstanceSet("saloon.balusters", balusterGeo, material("paint"));
  const bracketGeo = prototype(extrude(bracketShape(0.45), 0.08, { size: 0.008, segments: 1 }, 4));
  const brackets = new InstanceSet("saloon.brackets", bracketGeo, material("paint"));

  const tint = (base: string, i: number, amount = 0.08) => {
    const c = new Color(base);
    const n = Math.sin(i * 12.9898) * 43758.5453;
    const f = 1 - amount + (n - Math.floor(n)) * amount * 2;
    return c.multiplyScalar(f);
  };
  const BOARD_H = 0.19;

  // --- Walls: lap siding on a backing panel. Each board leans out at the bottom like real clapboard.
  const lap = (x0: number, x1: number, y: number, z: number, faceRot: number, i: number) => {
    const len = x1 - x0;
    if (len < 0.05) return;
    const m = new Matrix4().makeRotationY(faceRot).multiply(mat([(x0 + x1) / 2, y + BOARD_H / 2, z], [-0.07, 0, 0], [len, BOARD_H * 1.06, 1]));
    boards.add(m, tint(PAINT, i));
  };
  // Side walls (rotated ±90°) and the back wall: full rows.
  const rows = Math.ceil((EAVE - DECK + 0.3) / BOARD_H);
  for (let r = 0; r < rows; r++) {
    const y = DECK - 0.3 + r * BOARD_H;
    lap(-FRONT, FRONT, y, W / 2 + 0.02, Math.PI / 2, r);
    lap(-FRONT, FRONT, y, W / 2 + 0.02, -Math.PI / 2, r + 300);
    lap(-W / 2, W / 2, y, FRONT - D - 0.02 + 0.0, Math.PI, r + 600);
  }
  // Front wall and false front: rows split around the openings.
  const frontTop = 7.25;
  const frontRows = Math.ceil((frontTop - DECK) / BOARD_H);
  for (let r = 0; r < frontRows; r++) {
    const y = DECK + r * BOARD_H;
    const cuts = FRONT_OPENINGS.filter((o) => y + BOARD_H > o.y && y < o.y + o.h)
      .map((o) => [o.x - o.w / 2 - 0.12, o.x + o.w / 2 + 0.12] as const)
      .sort((a, b) => a[0] - b[0]);
    let x = -W / 2;
    for (const [a, b] of cuts) {
      lap(x, a, y, FRONT + 0.02, 0, r * 7 + Math.round(x * 3) + 900);
      x = b;
    }
    lap(x, W / 2, y, FRONT + 0.02, 0, r * 7 + 950);
  }

  // Backing walls (painted dark, behind the boards) with real holes for the openings.
  const front = new Shape();
  front.moveTo(-W / 2, 0);
  front.lineTo(W / 2, 0);
  front.lineTo(W / 2, frontTop);
  front.lineTo(W / 2 - 0.9, frontTop);
  front.lineTo(W / 2 - 0.9, frontTop + 0.45);
  front.lineTo(2.2, frontTop + 0.45);
  front.quadraticCurveTo(1.6, frontTop + 1.25, 0, frontTop + 1.3);
  front.quadraticCurveTo(-1.6, frontTop + 1.25, -2.2, frontTop + 0.45);
  front.lineTo(-W / 2 + 0.9, frontTop + 0.45);
  front.lineTo(-W / 2 + 0.9, frontTop);
  front.lineTo(-W / 2, frontTop);
  front.closePath();
  for (const o of FRONT_OPENINGS) front.holes.push(roundedRect(o.w, o.h, 0.01, o.x, o.y + o.h / 2) as unknown as Path);
  add(extrude(front, 0.12, undefined, 12), "paint", new Color(PAINT).multiplyScalar(0.8), mat([0, 0, FRONT - 0.05]));
  // The parapet above the siding gets its own boards (vertical, like a false front).
  for (let i = 0; i < 52; i++) {
    const x = -W / 2 + 0.95 + i * 0.155;
    if (x > W / 2 - 0.95) break;
    const top = Math.abs(x) < 2.2 ? frontTop + 0.45 + (1 - (x / 2.2) ** 2) * 0.82 : frontTop + 0.45;
    const h = top - frontTop + 0.02;
    boards.add(mat([x, frontTop + h / 2 - 0.01, FRONT + 0.03], [0, 0, Math.PI / 2], [h, 0.15, 1]), tint(PAINT, i + 1200));
  }
  // Side and back backing, and a dark interior shell seen through windows and doors.
  const side = extrude(roundedRect(D, EAVE + 0.2, 0.01, 0, (EAVE + 0.2) / 2), 0.1);
  add(side, "paint", DARK, mat([W / 2 - 0.05, 0, 0], [0, Math.PI / 2, 0]));
  add(side, "paint", DARK, mat([-W / 2 + 0.05, 0, 0], [0, Math.PI / 2, 0]));
  add(extrude(roundedRect(W, EAVE + 0.2, 0.01, 0, (EAVE + 0.2) / 2), 0.1), "paint", DARK, mat([0, 0, -FRONT + 0.05]));

  // Corner boards and trim.
  for (const sx of [-1, 1]) {
    add(extrude(roundedRect(0.22, frontTop + 0.45, 0.02, 0, (frontTop + 0.45) / 2), 0.08, { size: 0.01 }), "paint", TRIM, mat([sx * (W / 2 - 0.08), 0, FRONT + 0.07]));
    add(extrude(roundedRect(0.18, EAVE + 0.1, 0.02, 0, (EAVE + 0.1) / 2), 0.18, { size: 0.01 }), "paint", TRIM, mat([sx * (W / 2 + 0.03), 0, -FRONT + 0.06]));
  }
  // Cornice across the false front and along its stepped top, with brackets underneath.
  add(cornice(W + 0.3, 1.1), "paint", TRIM, mat([0, frontTop - 0.3, FRONT + 0.05]));
  for (const sx of [-1, 1]) add(cornice(0.95, 0.8), "paint", TRIM, mat([sx * (W / 2 - 0.47), frontTop + 0.45, FRONT + 0.05]));
  const arch = new Shape();
  arch.moveTo(-2.25, 0);
  arch.quadraticCurveTo(-1.62, 0.82, 0, 0.87);
  arch.quadraticCurveTo(1.62, 0.82, 2.25, 0);
  arch.lineTo(2.1, 0);
  arch.quadraticCurveTo(1.55, 0.7, 0, 0.74);
  arch.quadraticCurveTo(-1.55, 0.7, -2.1, 0);
  arch.closePath();
  add(extrude(arch, 0.2, { size: 0.015 }, 24), "paint", TRIM, mat([0, frontTop + 0.45, FRONT + 0.08]));
  for (let i = 0; i < 9; i++) {
    const x = -W / 2 + 0.6 + (i * (W - 1.2)) / 8;
    brackets.add(mat([x, frontTop - 0.6, FRONT + 0.06], [0, -Math.PI / 2, 0], [0.85, 0.85, 0.85]), TRIM);
  }
  // Belt course between floors.
  add(cornice(W + 0.2, 0.6), "paint", TRIM, mat([0, FLOOR2 + 0.02, FRONT + 0.04]));

  // --- Sign board between the upper windows and the cornice, framed by a moulding.
  const signW = 6.2;
  const signH = 0.58;
  const signY = frontTop - 0.98;
  const frame = roundedRect(signW + 0.24, signH + 0.24, 0.04);
  frame.holes.push(roundedRect(signW, signH, 0.02) as unknown as Path);
  add(extrude(frame, 0.08, { size: 0.015 }), "paint", TRIM, mat([0, signY, FRONT + 0.1]));

  // --- Openings: casings, sills, heads, sashes, glass, shutters, doors.
  const glass: Matrix4[] = [];
  for (const o of FRONT_OPENINGS) {
    const cx = o.x;
    const cy = o.y + o.h / 2;
    const casing = roundedRect(o.w + 0.26, o.h + (o.kind === "window" ? 0.26 : 0.13), 0.01, 0, o.kind === "window" ? 0 : 0.065);
    casing.holes.push(roundedRect(o.w, o.h, 0.005) as unknown as Path);
    add(extrude(casing, 0.07, { size: 0.01 }), "paint", TRIM, mat([cx, cy, FRONT + 0.1]));
    // Pedimented head: a cap moulding with a shallow gable on top.
    add(cornice(o.w + 0.42, 0.55), "paint", TRIM, mat([cx, o.y + o.h + 0.1, FRONT + 0.08]));
    // Gabled pediment on the ground floor only; upstairs keeps a flat cap under the sign.
    if (o.y < FLOOR2) add(extrude(polygon([[-(o.w + 0.36) / 2, 0], [(o.w + 0.36) / 2, 0], [0, 0.22]]), 0.06, { size: 0.01 }), "paint", TRIM, mat([cx, o.y + o.h + 0.25, FRONT + 0.1]));
    if (o.kind === "window") {
      add(extrude(polygon([[-(o.w + 0.4) / 2, 0], [(o.w + 0.4) / 2, 0], [(o.w + 0.34) / 2, 0.06], [-(o.w + 0.34) / 2, 0.06]]), 0.2, { size: 0.01 }), "paint", TRIM, mat([cx, o.y - 0.12, FRONT + 0.14]));
      // Two sashes, each with a 2×2 muntin grid.
      const bar = (w: number, h: number, x: number, y: number) => add(extrude(roundedRect(w, h, 0.004), 0.04), "paint", TRIM, mat([cx + x, cy + y, FRONT + 0.03]));
      bar(o.w, 0.05, 0, 0);
      bar(0.035, o.h, 0, 0);
      bar(o.w, 0.03, 0, o.h / 4);
      bar(o.w, 0.03, 0, -o.h / 4);
      glass.push(mat([cx, cy, FRONT - 0.005], [0, 0, 0], [o.w, o.h, 1]));
      if (o.y > FLOOR2) {
        // Louvred shutters, folded open against the wall.
        for (const sx of [-1, 1]) {
          const sw = o.w / 2;
          const shutterFrame = roundedRect(sw, o.h, 0.01);
          shutterFrame.holes.push(roundedRect(sw - 0.1, o.h - 0.12, 0.005) as unknown as Path);
          const sxPos = cx + sx * (o.w / 2 + 0.13 + sw / 2);
          add(extrude(shutterFrame, 0.05, { size: 0.006 }), "paint", "#2f4a3a", mat([sxPos, cy, FRONT + 0.1]));
          for (let k = 0; k < 9; k++) {
            add(extrude(roundedRect(sw - 0.1, 0.11, 0.01), 0.02), "paint", "#35523f", mat([sxPos, o.y + 0.12 + k * ((o.h - 0.24) / 8), FRONT + 0.1], [-0.6, 0, 0]));
          }
        }
      }
    } else if (o.kind === "door") {
      // Panelled balcony door, slightly ajar.
      const leaf = roundedRect(o.w - 0.04, o.h - 0.04, 0.01);
      leaf.holes.push(roundedRect(o.w - 0.34, o.h * 0.36, 0.02, 0, o.h * 0.2) as unknown as Path);
      leaf.holes.push(roundedRect(o.w - 0.34, o.h * 0.36, 0.02, 0, -o.h * 0.22) as unknown as Path);
      add(extrude(leaf, 0.05, { size: 0.008 }), "paint", "#4a2a1c", mat([cx, cy, FRONT - 0.02]));
      add(extrude(roundedRect(o.w - 0.34, o.h * 0.36, 0.02), 0.02), "glass", "#3b2a1a", mat([cx, cy + o.h * 0.2, FRONT - 0.03]));
      add(extrude(roundedRect(o.w - 0.34, o.h * 0.36, 0.02), 0.03), "paint", "#5a3524", mat([cx, cy - o.h * 0.22, FRONT - 0.03]));
    } else {
      // Batwing doors: two louvred leaves with scalloped tops, hung mid-height in a dark doorway.
      for (const sx of [-1, 1]) {
        const lw = o.w / 2 - 0.03;
        const leaf = new Shape();
        leaf.moveTo(-lw / 2, 0);
        leaf.lineTo(lw / 2, 0);
        leaf.lineTo(lw / 2, 0.95);
        leaf.quadraticCurveTo(0, 1.25 - (sx === 1 ? 0 : 0), -lw / 2, sx === 1 ? 1.12 : 0.95);
        leaf.closePath();
        const hole = roundedRect(lw - 0.14, 0.62, 0.02, 0, 0.42);
        leaf.holes.push(hole as unknown as Path);
        const lx = cx + sx * (lw / 2 + 0.015);
        const leafGeo = extrude(leaf, 0.045, { size: 0.008 }, 10);
        add(leafGeo, "paint", "#b48a5a", mat([lx, DECK + 0.55, FRONT + 0.03], [0, 0, 0], [-sx, 1, 1]));
        for (let k = 0; k < 7; k++) {
          add(extrude(roundedRect(lw - 0.14, 0.085, 0.01), 0.015), "paint", "#9a7048", mat([lx, DECK + 0.55 + 0.14 + k * 0.088, FRONT + 0.03], [-0.55, 0, 0]));
        }
      }
    }
  }

  // --- Boardwalk: deck boards on joists, front steps.
  const deckDepth = PORCH + 0.2;
  for (let i = 0; i < Math.floor(W / 0.155); i++) {
    const x = -W / 2 + 0.08 + i * 0.155;
    deck.add(mat([x, DECK - 0.017, FRONT + deckDepth / 2 - 0.1], [0, Math.PI / 2, 0], [deckDepth, 0.145, 1]), tint(RAW, i, 0.14));
  }
  add(extrude(roundedRect(W + 0.1, 0.25, 0.01), deckDepth, undefined, 2), "wood", new Color(RAW).multiplyScalar(0.7), mat([0, DECK - 0.17, FRONT + deckDepth / 2 - 0.1]));
  for (let s = 0; s < 2; s++) {
    const h = (DECK * (2 - s)) / 3;
    add(extrude(roundedRect(2.4, 0.06, 0.01), 0.32, { size: 0.008 }), "wood", tint(RAW, s + 40), mat([0, h, FRONT + deckDepth + 0.05 + (1 - s) * 0.3]));
  }

  // --- Balcony on turned posts: floor, fascia with scalloped valance, railing with balusters.
  const postH = FLOOR2 - DECK;
  const post = lathe(turnedProfile(postH, 0.07), 12);
  const postXs = [-4.7, -2.35, 0, 2.35, 4.7];
  for (const x of postXs) {
    add(post, "paint", TRIM, mat([x, DECK, FRONT + PORCH - 0.12]));
    for (const sx of [-1, 1]) brackets.add(mat([x + sx * 0.07, FLOOR2 - 0.5, FRONT + PORCH - 0.12], [0, sx === 1 ? 0 : Math.PI, 0], [0.9, 0.9, 0.9]), TRIM);
  }
  add(extrude(roundedRect(W + 0.2, 0.32, 0.01), PORCH + 0.1, undefined, 2), "paint", TRIM, mat([0, FLOOR2 + 0.0, FRONT + PORCH / 2]));
  for (let i = 0; i < Math.floor(W / 0.155); i++) {
    const x = -W / 2 + 0.08 + i * 0.155;
    deck.add(mat([x, FLOOR2 + 0.075, FRONT + PORCH / 2], [0, Math.PI / 2, 0], [PORCH, 0.145, 1]), tint(RAW, i + 100, 0.14));
  }
  const valance = new Shape();
  const vw = W + 0.2;
  valance.moveTo(-vw / 2, 0);
  valance.lineTo(vw / 2, 0);
  valance.lineTo(vw / 2, -0.12);
  const scallops = 26;
  for (let i = scallops; i > 0; i--) {
    const x0 = -vw / 2 + (i * vw) / scallops;
    const x1 = -vw / 2 + ((i - 1) * vw) / scallops;
    valance.quadraticCurveTo((x0 + x1) / 2, -0.3, x1, -0.12);
  }
  valance.closePath();
  add(extrude(valance, 0.04, undefined, 4), "paint", TRIM, mat([0, FLOOR2 - 0.15, FRONT + PORCH + 0.06]));
  // Railing: top and bottom rails with turned balusters between the posts.
  const rail = (y: number, h: number) => add(extrude(roundedRect(W + 0.1, h, 0.015), 0.09, { size: 0.01 }), "paint", TRIM, mat([0, y, FRONT + PORCH - 0.12]));
  rail(FLOOR2 + 0.95, 0.09);
  rail(FLOOR2 + 0.22, 0.06);
  for (let i = 0; i < 60; i++) {
    const x = -W / 2 + 0.2 + i * ((W - 0.4) / 59);
    if (postXs.some((p) => Math.abs(p - x) < 0.12)) continue;
    balusters.add(mat([x, FLOOR2 + 0.25, FRONT + PORCH - 0.12]), TRIM);
  }
  for (const x of postXs) add(extrude(roundedRect(0.14, 1.0, 0.01), 0.14, { size: 0.01 }), "paint", TRIM, mat([x, FLOOR2 + 0.6, FRONT + PORCH - 0.12]));

  // --- Roof: low gable from front to back behind the false front. Each slope is one extruded panel whose profile
  // steps like overlapping shingle courses (butt edges face the eave), plus a ridge cap and a stovepipe.
  const pitch = 0.32;
  const halfW = W / 2 + 0.3;
  const slope = halfW / Math.cos(pitch) + 0.08;
  const course = 0.24;
  const courses = Math.ceil(slope / course);
  const roofShape = new Shape();
  roofShape.moveTo(0, 0);
  roofShape.lineTo(courses * course, 0);
  for (let i = courses - 1; i >= 0; i--) {
    const s0 = i * course;
    roofShape.lineTo(s0 + course, 0.014);
    roofShape.lineTo(s0 + 0.004, 0.046);
    roofShape.lineTo(s0, 0.046);
  }
  roofShape.closePath();
  // Stops just behind the false front so nothing pokes through its face.
  const roofPanel = extrude(roofShape, D - 0.1, undefined, 1);
  const c = Math.cos(pitch);
  const sn = Math.sin(pitch);
  for (const sx of [-1, 1]) {
    // Basis: along the slope (eave → ridge), out of the roof, along the building.
    const m = new Matrix4().makeBasis(new Vector3(-sx * c, sn, 0), new Vector3(sx * sn, c, 0), new Vector3(0, 0, 1));
    m.setPosition(sx * halfW, EAVE + 0.05, -0.15);
    add(roofPanel, "wood", "#5e4a3a", m);
    // Fascia board along the eave.
    add(extrude(roundedRect(0.05, 0.2, 0.01), D - 0.05, undefined, 1), "paint", TRIM, mat([sx * (halfW + 0.02), EAVE - 0.02, -0.15]));
  }
  const ridgeY = EAVE + 0.05 + halfW * Math.tan(pitch) + 0.02;
  add(extrude(polygon([[-0.16, 0], [0.16, 0], [0, 0.09]]), D - 0.05, undefined, 1), "wood", "#4f3f30", mat([0, ridgeY, -0.15]));
  const pipe = lathe([[0, 0], [0.11, 0], [0.11, 1.3], [0.16, 1.32], [0.17, 1.42], [0.06, 1.48], [0, 1.48]], 12);
  add(pipe, "steel", STEEL, mat([-2.6, EAVE + 0.6, -2.4]));

  // Gable at the back.
  add(extrude(polygon([[-W / 2, 0], [W / 2, 0], [0, (W / 2) * Math.tan(pitch)]]), 0.1), "paint", PAINT, mat([0, EAVE, -FRONT - 0.02]));

  // --- Lanterns on the outer posts, barrels and a water trough out front, a hitching rail.
  const lantern = lathe([[0, 0], [0.09, 0], [0.11, 0.05], [0.11, 0.3], [0.06, 0.36], [0.07, 0.4], [0.02, 0.44], [0, 0.46]], 10);
  for (const x of [-4.7, 4.7]) {
    add(lantern, "lamp", "#ffcf7a", mat([x, 2.35, FRONT + PORCH + 0.05]));
    add(extrude(roundedRect(0.04, 0.3, 0.01), 0.04), "steel", STEEL, mat([x, 2.9, FRONT + PORCH - 0.02], [0.6, 0, 0]));
  }
  const barrel = lathe([[0, 0], [0.26, 0], [0.3, 0.2], [0.32, 0.42], [0.3, 0.64], [0.26, 0.84], [0, 0.84]], 16);
  const hoop = lathe([[0.305, 0], [0.315, 0], [0.315, 0.045], [0.305, 0.045]], 16);
  const barrelSpots: [number, number, number][] = [
    [-4.4, DECK, FRONT + 0.6],
    [-3.85, DECK, FRONT + 0.45],
    [4.3, DECK, FRONT + 0.55],
  ];
  for (const [x, y, z] of barrelSpots) {
    add(barrel, "wood", "#6e4c30", mat([x, y, z]));
    for (const hy of [0.12, 0.66]) add(hoop, "steel", STEEL, mat([x, y + hy, z], [0, 0, 0], [1.02, 1, 1.02]));
  }
  // Water trough: a U-section of planks with end caps.
  const trough = new Shape();
  trough.moveTo(-0.32, 0.5);
  trough.lineTo(-0.28, 0);
  trough.lineTo(0.28, 0);
  trough.lineTo(0.32, 0.5);
  trough.lineTo(0.26, 0.5);
  trough.lineTo(0.23, 0.06);
  trough.lineTo(-0.23, 0.06);
  trough.lineTo(-0.26, 0.5);
  trough.closePath();
  add(extrude(trough, 2.0, { size: 0.01 }), "wood", "#5e4530", mat([-2.6, 0, FRONT + PORCH + 1.3], [0, Math.PI / 2, 0]));
  add(new PlaneGeometry(1.94, 0.48), "glass", "#24343a", mat([-2.6, 0.38, FRONT + PORCH + 1.3], [-Math.PI / 2, 0, 0]));
  // Hitching rail: two turned posts and a rail.
  const hpost = lathe(turnedProfile(1.05, 0.06), 10);
  for (const x of [1.6, 4.0]) add(hpost, "wood", "#6a4a30", mat([x, 0, FRONT + PORCH + 1.2]));
  add(extrude(roundedRect(0.1, 0.1, 0.03), 2.7, { size: 0.01 }), "wood", "#6a4a30", mat([2.8, 1.0, FRONT + PORCH + 1.2], [0, Math.PI / 2, 0]));

  // --- Assemble.
  const group = new Group();
  group.name = "building.saloon";
  let triangles = 0;
  let drawCalls = 0;
  for (const [key, geometry] of parts.build()) {
    if (!isMaterialKey(key)) continue;
    const mesh = new Mesh(geometry, material(key));
    mesh.name = `saloon.${key}`;
    mesh.castShadow = key !== "glass";
    mesh.receiveShadow = true;
    group.add(mesh);
    triangles += triangleCount(geometry);
    drawCalls++;
  }
  const glassProto = prototype(new PlaneGeometry(1, 1));
  const panes = new InstanceSet("saloon.glass", glassProto, material("glass"));
  for (const m of glass) panes.add(m, "#40342a");
  for (const set of [boards, deck, balusters, brackets, panes]) {
    if (set.count === 0) continue;
    const mesh = set.build();
    if (set === panes) mesh.castShadow = false;
    group.add(mesh);
    triangles += triangleCount(set === panes ? glassProto : (mesh.geometry as BufferGeometry)) * set.count;
    drawCalls++;
  }

  // The sign face (its own material: the only texture with lettering).
  const tex = signTexture("SALOON", undefined, signW / signH);
  const sign = new Mesh(new PlaneGeometry(signW, signH), new MeshStandardMaterial({ map: tex, color: tex ? "#ffffff" : "#e6d6ae", roughness: 0.8 }));
  sign.position.set(0, signY, FRONT + 0.09);
  sign.name = "saloon.sign";
  group.add(sign);
  triangles += 2;
  drawCalls++;

  // Interior: one dark inward-facing shell, seen through the windows and the batwing doors.
  const interior = new Mesh(
    prototypeBox(W - 0.3, EAVE - DECK, D - 0.3),
    new MeshStandardMaterial({ color: "#24180f", roughness: 1, side: BackSide }),
  );
  interior.position.set(0, DECK + (EAVE - DECK) / 2, 0);
  interior.name = "saloon.interior";
  group.add(interior);
  triangles += 12;
  drawCalls++;

  return { group, triangles, drawCalls };
}
