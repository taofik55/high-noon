import { Matrix4, Path, Shape, Vector3 } from "three";
import { extrude, lathe, mat, polygon, roundedRect } from "../core/shapes";
import { sweep } from "../core/sweep";
import { cornice, prototype, turnedProfile, type BuiltBuilding, type Opening } from "./kit";
import { awning, backing, boardwalk, frameAt, gableRoof, interior, Kit, opening, signBoard, siding, stoneWall, tint, TRIM_COLOR } from "./pieces";

/**
 * The rest of the town (docs/05 §2), each with its own silhouette and materials, all from the shared kit. Fronts face
 * +Z, centred on x, ground at y = 0; footprints follow world/layout.ts BUILDINGS.
 */

const DECK = 0.45;
const front = (d: number) => mat([0, 0, d / 2]);
const back = (d: number) => mat([0, 0, -d / 2], [0, Math.PI, 0]);
const right = (w: number) => mat([w / 2, 0, 0], [0, Math.PI / 2, 0]);
const left = (w: number) => mat([-w / 2, 0, 0], [0, -Math.PI / 2, 0]);

function star(points: number, outer: number, inner: number): Shape {
  const s = new Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

function stoop(kit: Kit, frame: Matrix4, x: number, w: number, steps: number, color: string, key: "wood" | "stone" = "wood"): void {
  for (let s = 0; s < steps; s++) {
    const h = (DECK * (steps - s)) / (steps + 1);
    kit.add(extrude(roundedRect(w, 0.06, 0.01), 0.3, { size: 0.008 }), key, tint(color, s + 40), frameAt(frame, mat([x, h, 0.15 + (steps - s) * 0.3])));
  }
}

// --- Sheriff's office and jail -------------------------------------------------------------------------------

export function buildSheriff(): BuiltBuilding {
  const kit = new Kit();
  const W = 8;
  const D = 6;
  const OCHRE = "#b08a50";
  const STONE = "#a89a84";
  const office: Opening[] = [
    { x: -2.7, y: DECK, w: 1.0, h: 2.3, kind: "door" },
    { x: -1.0, y: 1.2, w: 1.1, h: 1.4, kind: "window" },
  ];
  const jail: Opening[] = [
    { x: 1.2, y: 1.9, w: 0.7, h: 0.6, kind: "window" },
    { x: 3.0, y: 1.9, w: 0.7, h: 0.6, kind: "window" },
    { x: 2.1, y: 0.2, w: 0.9, h: 2.2, kind: "door" },
  ];
  const f = front(D);
  // Office half: board and batten under a stepped false front; jail half: dressed stone, lower.
  const ff = new Shape();
  ff.moveTo(-W / 2, 0);
  ff.lineTo(0, 0);
  ff.lineTo(0, 4.3);
  ff.lineTo(-0.6, 4.3);
  ff.lineTo(-0.6, 4.75);
  ff.lineTo(-3.4, 4.75);
  ff.lineTo(-3.4, 4.3);
  ff.lineTo(-W / 2, 4.3);
  ff.closePath();
  backing(kit, f, W, 4.3, office, "#4a3826", ff);
  siding(kit, f, { x0: -W / 2, x1: 0, y0: 0, y1: 4.3, openings: office, color: OCHRE, style: "batten" });
  siding(kit, f, { x0: -3.4, x1: -0.6, y0: 4.3, y1: 4.75, color: OCHRE, style: "batten" });
  stoneWall(kit, f, { x0: 0, x1: W / 2, y0: 0, y1: 3.7, openings: jail, color: STONE });
  backing(kit, frameAt(f, mat([W / 4, 0, 0])), W / 2, 3.7, jail.map((o) => ({ ...o, x: o.x - W / 4 })), "#3a3430");
  kit.add(cornice(W / 2 + 0.2, 0.7), "stone", STONE, frameAt(f, mat([W / 4, 3.62, 0.08])));
  kit.add(cornice(W / 2 + 0.2, 0.9), "paint", TRIM_COLOR, frameAt(f, mat([-W / 4, 4.12, 0.08])));
  for (const o of office) opening(kit, f, o, { shutters: o.kind === "window" ? "#5a3a24" : undefined, doorColor: "#5a3420" });
  for (const o of jail.filter((x) => x.kind === "window")) opening(kit, f, o, { bars: true, trim: "#7a6e60" });
  // Iron-strapped jail door with rivets.
  const jd = jail[2] as Opening;
  kit.add(extrude(roundedRect(jd.w, jd.h, 0.02), 0.07, { size: 0.01 }), "steel", "#5a544c", frameAt(f, mat([jd.x, jd.y + jd.h / 2, 0.0])));
  const rivet = lathe([[0, 0], [0.018, 0], [0.012, 0.012], [0, 0.014]], 6);
  for (const y of [0.35, 1.1, 1.85]) {
    kit.add(extrude(roundedRect(jd.w + 0.04, 0.09, 0.01), 0.025), "steel", "#26221e", frameAt(f, mat([jd.x, jd.y + y, 0.03])));
    for (let i = 0; i < 6; i++) kit.add(rivet, "steel", "#4a4640", frameAt(f, mat([jd.x - jd.w / 2 + 0.08 + i * ((jd.w - 0.16) / 5), jd.y + y, 0.045], [Math.PI / 2, 0, 0])));
  }
  // The star over the office door.
  kit.add(extrude(star(5, 0.28, 0.12), 0.04, { size: 0.01 }), "brass", "#c9a24a", frameAt(f, mat([-2.7, 3.25, 0.12])));
  kit.add(lathe([[0, 0], [0.34, 0], [0.34, 0.03], [0, 0.03]], 24), "paint", "#3a2a1a", frameAt(f, mat([-2.7, 3.25, 0.08], [Math.PI / 2, 0, 0])));
  signBoard(kit, f, "SHERIFF", -2.0, 3.85, 2.6, 0.45);
  kit.sign("JAIL", 1.2, 0.36, frameAt(f, mat([2.1, 3.1, 0.13])), { ground: "#2e2a26", ink: "#e6dcc4" });
  // Porch over the office.
  boardwalk(kit, f, -W / 2, 0.2, 2.0, DECK);
  awning(kit, f, -W / 2, 0, 2.0, 3.55, 3, "#7a5a36", DECK);
  stoop(kit, frameAt(f, mat([0, 0, 2.0])), -2.7, 1.4, 2, "#8a6a4a");
  // A bench on the porch.
  for (const [y, z, h] of [[0.85, 0.35, 0.05], [1.2, 0.18, 0.2]] as const) kit.add(extrude(roundedRect(1.8, h, 0.01), z === 0.35 ? 0.4 : 0.04, { size: 0.008 }), "wood", "#6a4a30", frameAt(f, mat([-1.1, y, z + 0.15])));
  for (const x of [-1.85, -0.35]) kit.add(extrude(roundedRect(0.06, 0.45, 0.01, 0, 0.22), 0.36, { size: 0.006 }), "wood", "#5a3e28", frameAt(f, mat([x, DECK, 0.5])));
  // Sides and back.
  const sideOpen: Opening[] = [{ x: 1.4, y: 1.9, w: 0.7, h: 0.6, kind: "window" }];
  stoneWall(kit, right(W), { x0: -D / 2, x1: D / 2, y0: 0, y1: 3.7, openings: sideOpen, color: STONE });
  backing(kit, right(W), D, 3.7, sideOpen, "#3a3430");
  opening(kit, right(W), sideOpen[0] as Opening, { bars: true, trim: "#7a6e60" });
  siding(kit, left(W), { x0: -D / 2, x1: D / 2, y0: 0, y1: 3.6, color: OCHRE, style: "batten" });
  backing(kit, left(W), D, 3.6, [], "#4a3826");
  siding(kit, back(D), { x0: -W / 2, x1: W / 2, y0: 0, y1: 3.6, color: OCHRE, style: "batten" });
  backing(kit, back(D), W, 3.6, [], "#4a3826");
  gableRoof(kit, new Matrix4(), W, D - 0.4, 3.6, 0.22, OCHRE, false);
  kit.add(extrude(polygon([[-W / 2, 0], [W / 2, 0], [0, (W / 2) * Math.tan(0.22)]]), 0.1), "paint", OCHRE, mat([0, 3.6, -D / 2 + 0.03]));
  interior(kit, W - 0.3, 3.4, D - 0.3, [0, 0.2, 0]);
  return kit.build("building.sheriff");
}

// --- Bank (Wells Fargo) --------------------------------------------------------------------------------------

export function buildBank(): BuiltBuilding {
  const kit = new Kit();
  const W = 6;
  const D = 8;
  const H = 5;
  const STONE = "#c8b89a";
  const CREAM = "#d8c8a8";
  const ops: Opening[] = [
    { x: 0, y: DECK, w: 1.4, h: 2.6, kind: "door" },
    { x: -1.9, y: 1.0, w: 0.95, h: 2.1, kind: "window" },
    { x: 1.9, y: 1.0, w: 0.95, h: 2.1, kind: "window" },
  ];
  const f = front(D);
  backing(kit, f, W, H, ops, "#5a5040");
  stoneWall(kit, f, { x0: -W / 2, x1: W / 2, y0: 0, y1: 4.15, openings: ops, color: STONE, block: [0.7, 0.35] });
  for (const o of ops) opening(kit, f, o, { pediment: o.kind === "window", doorColor: "#3a2416", trim: "#e8dcc0" });
  // Transom over the doors.
  kit.add(extrude(roundedRect(1.4, 0.45, 0.01), 0.04), "paint", "#e8dcc0", frameAt(f, mat([0, DECK + 2.95, 0.04])));
  kit.pane(frameAt(f, mat([0, DECK + 2.95, 0.02], [0, 0, 0], [1.25, 0.35, 1])));
  // Pilasters with bases and capitals.
  for (const x of [-2.85, -0.95, 0.95, 2.85]) {
    kit.add(extrude(roundedRect(0.3, 3.9, 0.02, 0, 1.95), 0.14, { size: 0.015 }), "stone", "#ddd0b4", frameAt(f, mat([x, 0.15, 0.12])));
    kit.add(cornice(0.46, 0.45), "stone", "#e6dac0", frameAt(f, mat([x, 3.95, 0.14])));
    kit.add(extrude(roundedRect(0.42, 0.2, 0.02, 0, 0.1), 0.2, { size: 0.015 }), "stone", "#bcae92", frameAt(f, mat([x, 0, 0.14])));
  }
  // Frieze with the company name, a heavy cornice with dentils, and a parapet with a central pediment.
  kit.add(extrude(roundedRect(W + 0.2, 0.7, 0.01, 0, 0.35), 0.12), "stone", "#d8cbb0", frameAt(f, mat([0, 4.15, 0.06])));
  kit.sign("WELLS FARGO & CO.", 4.6, 0.42, frameAt(f, mat([0, 4.5, 0.13])), { ground: "#24402f", ink: "#e0c068" });
  kit.add(cornice(W + 0.6, 1.5), "stone", "#e6dac0", frameAt(f, mat([0, 4.85, 0.08])));
  const dentil = kit.set("dentils", () => prototype(extrude(roundedRect(0.07, 0.09, 0.008), 0.07, undefined, 1)), "stone");
  for (let x = -W / 2; x <= W / 2; x += 0.16) dentil.add(frameAt(f, mat([x, 4.8, 0.17])), "#e6dac0");
  kit.add(extrude(polygon([[-1.6, 0], [1.6, 0], [0, 0.7]]), 0.16, { size: 0.02 }), "stone", "#e0d4b8", frameAt(f, mat([0, 5.25, 0.06])));
  kit.add(extrude(roundedRect(W + 0.4, 0.35, 0.02, 0, 0.17), 0.2), "stone", STONE, frameAt(f, mat([0, 5.0, 0.0])));
  stoop(kit, f, 0, 2.2, 3, STONE, "stone");
  // Sides (cream lap siding) and back, flat roof behind the parapet.
  const sideWin: Opening[] = [{ x: -1.5, y: 1.2, w: 0.9, h: 1.6, kind: "window" }, { x: 1.5, y: 1.2, w: 0.9, h: 1.6, kind: "window" }];
  for (const fr of [right(W), left(W)]) {
    siding(kit, fr, { x0: -D / 2, x1: D / 2, y0: 0, y1: H, openings: sideWin, color: CREAM });
    backing(kit, fr, D, H, sideWin, "#5a5040");
    for (const o of sideWin) opening(kit, fr, o, { bars: true });
  }
  siding(kit, back(D), { x0: -W / 2, x1: W / 2, y0: 0, y1: H, color: CREAM });
  backing(kit, back(D), W, H, [], "#5a5040");
  kit.add(extrude(roundedRect(W, D, 0.01), 0.12), "wood", "#4a3a2c", mat([0, H - 0.1, 0], [Math.PI / 2, 0, 0]));
  interior(kit, W - 0.3, H - 0.5, D - 0.3, [0, 0.2, 0]);
  return kit.build("building.bank");
}

// --- General store -------------------------------------------------------------------------------------------

export function buildStore(): BuiltBuilding {
  const kit = new Kit();
  const W = 6;
  const D = 8;
  const BLUE = "#7a8a8a";
  const ops: Opening[] = [
    { x: 0, y: DECK, w: 1.3, h: 2.4, kind: "door" },
    { x: -1.85, y: 0.8, w: 1.6, h: 1.9, kind: "window" },
    { x: 1.85, y: 0.8, w: 1.6, h: 1.9, kind: "window" },
  ];
  const f = front(D);
  const ff = new Shape();
  ff.moveTo(-W / 2, 0);
  ff.lineTo(W / 2, 0);
  ff.lineTo(W / 2, 4.6);
  ff.lineTo(W / 2 - 0.6, 4.6);
  ff.lineTo(W / 2 - 0.6, 5.1);
  ff.lineTo(1.2, 5.1);
  ff.lineTo(1.2, 5.6);
  ff.lineTo(-1.2, 5.6);
  ff.lineTo(-1.2, 5.1);
  ff.lineTo(-W / 2 + 0.6, 5.1);
  ff.lineTo(-W / 2 + 0.6, 4.6);
  ff.lineTo(-W / 2, 4.6);
  ff.closePath();
  backing(kit, f, W, 4.6, ops, "#3e4446", ff);
  siding(kit, f, { x0: -W / 2, x1: W / 2, y0: 0, y1: 4.6, openings: ops, color: BLUE });
  siding(kit, f, { x0: -W / 2 + 0.6, x1: W / 2 - 0.6, y0: 4.6, y1: 5.1, color: BLUE });
  siding(kit, f, { x0: -1.2, x1: 1.2, y0: 5.1, y1: 5.6, color: BLUE });
  for (const [x, y, w] of [[0, 4.5, W + 0.2], [0, 5.0, W - 1.0], [0, 5.5, 2.6]] as const) kit.add(cornice(w, 0.7), "paint", TRIM_COLOR, frameAt(f, mat([x, y, 0.06])));
  for (const o of ops) opening(kit, f, o, { doorColor: "#2e3a3a" });
  // Display windows get a finer grid of muntins.
  for (const o of ops.filter((x) => x.kind === "window")) {
    for (const dx of [-o.w / 4, o.w / 4]) kit.add(extrude(roundedRect(0.03, o.h, 0.004), 0.04), "paint", TRIM_COLOR, frameAt(f, mat([o.x + dx, o.y + o.h / 2, 0.02])));
  }
  signBoard(kit, f, "GENERAL STORE", 0, 3.95, 4.8, 0.62, { ground: "#ece0c0", ink: "#24384a" });
  boardwalk(kit, f, -W / 2, W / 2, 2.2, DECK);
  awning(kit, f, -W / 2, W / 2, 2.2, 3.45, 4, "#d8ccb0", DECK);
  stoop(kit, frameAt(f, mat([0, 0, 2.2])), 0, 1.6, 2, "#8a6a4a");
  // Goods on the porch: crates, a barrel, flour sacks.
  const crate = crateGeometry();
  for (const [x, z, r, s] of [[-2.4, 0.6, 0.1, 1], [-2.45, 0.55, -0.05, 0.75], [2.3, 0.7, 0.3, 0.9]] as const) {
    kit.add(crate, "wood", tint("#9a7a50", Math.round(x * 10)), frameAt(f, mat([x, DECK + (s === 0.75 ? 0.62 : 0), z], [0, r, 0], s)));
  }
  kit.add(barrelGeometry(), "wood", "#6e4c30", frameAt(f, mat([2.5, DECK, 1.4])));
  for (const [x, z] of [[-1.5, 0.4], [-1.25, 0.45], [-1.38, 0.62]] as const) kit.add(sackGeometry(), "cloth", "#d8ccaa", frameAt(f, mat([x, DECK, z], [0, x * 2, 0])));
  for (const fr of [right(W), left(W)]) {
    siding(kit, fr, { x0: -D / 2, x1: D / 2, y0: 0, y1: 4.0, color: BLUE });
    backing(kit, fr, D, 4.0, [], "#3e4446");
  }
  siding(kit, back(D), { x0: -W / 2, x1: W / 2, y0: 0, y1: 4.0, color: BLUE });
  backing(kit, back(D), W, 4.0, [], "#3e4446");
  gableRoof(kit, mat([0, 0, -0.2]), W, D - 0.6, 4.0, 0.3, BLUE, false);
  kit.add(extrude(polygon([[-W / 2, 0], [W / 2, 0], [0, (W / 2) * Math.tan(0.3)]]), 0.1), "paint", BLUE, mat([0, 4.0, -D / 2 + 0.03]));
  interior(kit, W - 0.3, 3.8, D - 0.3, [0, 0.2, 0]);
  return kit.build("building.store");
}

// --- Stable (barn) -------------------------------------------------------------------------------------------

export function buildStable(): BuiltBuilding {
  const kit = new Kit();
  const W = 7;
  const D = 9;
  const WOOD = "#7a5a3a";
  const wallH = 3.0;
  // Gambrel profile: steep lower slopes, shallow upper slopes.
  const knee = { x: W / 2 - 0.9, y: wallH + 1.3 };
  const ridgeY = knee.y + 1.0;
  const outline = new Shape();
  outline.moveTo(-W / 2, 0);
  outline.lineTo(W / 2, 0);
  outline.lineTo(W / 2, wallH);
  outline.lineTo(knee.x, knee.y);
  outline.lineTo(0, ridgeY);
  outline.lineTo(-knee.x, knee.y);
  outline.lineTo(-W / 2, wallH);
  outline.closePath();
  const door: Opening = { x: 0, y: 0, w: 3.0, h: 2.9, kind: "door" };
  const loft: Opening = { x: 0, y: 3.35, w: 1.2, h: 1.0, kind: "door" };
  const f = front(D);
  backing(kit, f, W, ridgeY, [door, loft], "#3a2a1c", outline);
  for (const fr of [f, back(D)]) {
    const isFront = fr === f;
    // Vertical boards up the gable: rows clipped to the gambrel outline.
    for (let x = -W / 2 + 0.12; x < W / 2; x += 0.24) {
      const ax = Math.abs(x);
      const top = ax > knee.x ? wallH + ((W / 2 - ax) / (W / 2 - knee.x)) * (knee.y - wallH) : knee.y + ((knee.x - ax) / knee.x) * (ridgeY - knee.y);
      const cuts = isFront ? [door, loft].filter((o) => ax < o.w / 2 + 0.05) : [];
      let y = 0;
      for (const o of [...cuts, { y: top, h: 0 } as Opening]) {
        const end = Math.min(o.y, top);
        if (end - y > 0.05) {
          kit.plank(frameAt(fr, mat([x, (y + end) / 2, 0.015], [0, 0, Math.PI / 2], [end - y, 0.235, 1])), tint(WOOD, kit.next(), 0.15), "wood");
          kit.plank(frameAt(fr, mat([x + 0.12, (y + end) / 2, 0.045], [0, 0, Math.PI / 2], [end - y, 0.05, 1])), tint(WOOD, kit.next(), 0.2), "wood");
        }
        y = Math.max(y, o.y + o.h);
      }
    }
  }
  backing(kit, back(D), W, ridgeY, [], "#3a2a1c", outline.clone());
  for (const fr of [right(W), left(W)]) {
    siding(kit, fr, { x0: -D / 2, x1: D / 2, y0: 0, y1: wallH, color: WOOD, style: "batten", key: "wood" });
    backing(kit, fr, D, wallH, [], "#3a2a1c");
  }
  // Roof: four shingle panels following the gambrel.
  const panel = (from: Vector3, to: Vector3) => {
    const dir = to.clone().sub(from);
    const len = dir.length() + 0.12;
    dir.normalize();
    const up = new Vector3(-dir.y, dir.x, 0);
    if (up.y < 0) up.negate();
    const course = 0.24;
    const n = Math.ceil(len / course);
    const s = new Shape();
    s.moveTo(0, 0);
    s.lineTo(n * course, 0);
    for (let i = n - 1; i >= 0; i--) {
      s.lineTo(i * course + course, 0.014);
      s.lineTo(i * course + 0.004, 0.046);
      s.lineTo(i * course, 0.046);
    }
    s.closePath();
    const m = new Matrix4().makeBasis(dir, up, new Vector3(0, 0, 1));
    m.setPosition(from.x - dir.x * 0.1, from.y - dir.y * 0.1, 0);
    kit.add(extrude(s, D + 0.4, undefined, 1), "wood", "#5a4636", m);
  };
  for (const sx of [-1, 1]) {
    panel(new Vector3(sx * (W / 2 + 0.15), wallH - 0.1, 0), new Vector3(sx * knee.x, knee.y, 0));
    panel(new Vector3(sx * knee.x, knee.y, 0), new Vector3(0, ridgeY + 0.04, 0));
  }
  kit.add(extrude(polygon([[-0.16, 0], [0.16, 0], [0, 0.09]]), D + 0.5, undefined, 1), "wood", "#4a3828", mat([0, ridgeY + 0.04, 0]));
  // Big doors with X braces, slid half open; hayloft door with hay; hoist beam.
  for (const sx of [-1, 1]) {
    const x = sx * (door.w / 4 + (sx === 1 ? 0.6 : 0));
    const frm = roundedRect(door.w / 2, door.h, 0.02);
    frm.holes.push(roundedRect(door.w / 2 - 0.2, door.h - 0.2, 0.01) as unknown as Path);
    kit.add(extrude(frm, 0.06, { size: 0.01 }), "paint", "#8a2a1e", frameAt(f, mat([x, door.h / 2, 0.06])));
    kit.add(extrude(roundedRect(door.w / 2 - 0.2, door.h - 0.2, 0.01), 0.03), "wood", "#6a4a30", frameAt(f, mat([x, door.h / 2, 0.04])));
    const diag = Math.hypot(door.w / 2 - 0.2, door.h - 0.2);
    const ang = Math.atan2(door.h - 0.2, door.w / 2 - 0.2);
    for (const a of [ang, -ang]) kit.add(extrude(roundedRect(diag, 0.12, 0.01), 0.05), "paint", "#8a2a1e", frameAt(f, mat([x, door.h / 2, 0.08], [0, 0, a])));
  }
  kit.add(extrude(roundedRect(door.w + 1.4, 0.1, 0.02), 0.08), "steel", "#2a2826", frameAt(f, mat([0.3, door.h + 0.12, 0.1])));
  kit.add(extrude(roundedRect(loft.w, loft.h, 0.02), 0.05, { size: 0.01 }), "paint", "#8a2a1e", frameAt(f, mat([loft.w + 0.05, loft.y + loft.h / 2, 0.25], [0, -1.2, 0])));
  kit.add(extrude(roundedRect(0.18, 0.18, 0.02), 1.6, { size: 0.01 }), "wood", "#5a4030", frameAt(f, mat([0, ridgeY - 0.35, 0.5])));
  kit.add(lathe([[0, -0.03], [0.1, -0.03], [0.12, 0], [0.1, 0.03], [0, 0.03]], 12), "steel", "#3a3632", frameAt(f, mat([0, ridgeY - 0.55, 1.1], [0, 0, Math.PI / 2])));
  signBoard(kit, f, "STABLE", -1.75, loft.y + 0.45, 1.4, 0.34, { ground: "#e6d6ae", ink: "#5a1d14" });
  // Hay bales stacked by the door and spilling from the loft; a corral fence along one side.
  const bale = baleGeometry();
  for (const [x, y, z, r] of [[-2.6, 0, 0.6, 0.1], [-2.55, 0, 1.25, -0.08], [-2.6, 0.42, 0.95, 0.05], [2.7, 0, 0.8, 1.5]] as const) kit.add(bale, "cloth", tint("#c8a860", Math.round(z * 10), 0.1), frameAt(f, mat([x, y, z], [0, r, 0])));
  kit.add(bale, "cloth", "#c8a860", frameAt(f, mat([0.05, loft.y + 0.02, 0.15], [0, 0, 0.05], [1.2, 0.7, 0.9])));
  for (let i = 0; i < 6; i++) {
    const z = -D / 2 + 0.4 + i * 1.6;
    kit.add(lathe(turnedProfile(1.3, 0.07).map(([r, y]) => [r * 0.8, y] as [number, number]), 6), "wood", "#5a4030", mat([W / 2 + 2.5, 0, z]));
    for (const y of [0.45, 0.85, 1.2]) if (i < 5) kit.plank(mat([W / 2 + 2.5, y, z + 0.8], [0, Math.PI / 2, 0], [1.6, 0.14, 1]), tint("#7a5a3a", i * 3 + y * 10, 0.15), "wood");
  }
  interior(kit, W - 0.3, wallH + 1.0, D - 0.3, [0, 0, 0]);
  return kit.build("building.stable");
}

// --- Undertaker ----------------------------------------------------------------------------------------------

export function buildUndertaker(): BuiltBuilding {
  const kit = new Kit();
  const W = 5;
  const D = 6;
  const GREY = "#4a524c";
  const ops: Opening[] = [
    { x: -1.0, y: DECK, w: 1.0, h: 2.3, kind: "door" },
    { x: 1.15, y: 1.15, w: 1.0, h: 1.5, kind: "window" },
  ];
  const f = front(D);
  const ff = new Shape();
  ff.moveTo(-W / 2, 0);
  ff.lineTo(W / 2, 0);
  ff.lineTo(W / 2, 4.2);
  ff.lineTo(0, 5.4);
  ff.lineTo(-W / 2, 4.2);
  ff.closePath();
  backing(kit, f, W, 4.2, ops, "#222624", ff);
  siding(kit, f, { x0: -W / 2, x1: W / 2, y0: 0, y1: 4.2, openings: ops, color: GREY });
  for (let i = 0; i < 6; i++) {
    const y = 4.2 + i * 0.2;
    const half = W / 2 - (i * 0.2 * (W / 2)) / 1.2;
    if (half > 0.1) kit.plank(frameAt(f, mat([0, y + 0.1, 0.02], [-0.07, 0, 0], [half * 2, 0.2, 1])), tint(GREY, i + 70), "paint");
  }
  // Raking cornices up the pointed false front.
  const rake = Math.atan2(1.2, W / 2);
  for (const sx of [-1, 1]) kit.add(cornice(Math.hypot(1.2, W / 2) + 0.3, 0.7), "paint", "#1e1e1e", frameAt(f, mat([sx * W / 4, 4.8, 0.06], [0, 0, -sx * rake])));
  kit.add(cornice(W + 0.2, 0.7), "paint", "#1e1e1e", frameAt(f, mat([0, 4.0, 0.06])));
  for (const o of ops) opening(kit, f, o, { trim: "#1e1e1e", doorColor: "#141414", shutters: o.kind === "window" ? "#1e1e1e" : undefined });
  signBoard(kit, f, "UNDERTAKER", 0, 3.45, 3.4, 0.45, { ground: "#141414", ink: "#e8e0d0" });
  boardwalk(kit, f, -W / 2, W / 2, 1.6, DECK);
  // Coffins standing against the front wall, one with its lid ajar.
  const coffin = coffinGeometry();
  for (const [x, r] of [[2.0, -0.12], [-2.15, 0.1]] as const) kit.add(coffin, "wood", "#3a2618", frameAt(f, mat([x, DECK + 0.02, 0.35], [-0.18, r, 0])));
  for (const fr of [right(W), left(W)]) {
    siding(kit, fr, { x0: -D / 2, x1: D / 2, y0: 0, y1: 3.8, color: GREY });
    backing(kit, fr, D, 3.8, [], "#222624");
  }
  siding(kit, back(D), { x0: -W / 2, x1: W / 2, y0: 0, y1: 3.8, color: GREY });
  backing(kit, back(D), W, 3.8, [], "#222624");
  gableRoof(kit, mat([0, 0, -0.2]), W, D - 0.6, 3.8, 0.4, GREY, false);
  kit.add(extrude(polygon([[-W / 2, 0], [W / 2, 0], [0, (W / 2) * Math.tan(0.4)]]), 0.1), "paint", GREY, mat([0, 3.8, -D / 2 + 0.03]));
  interior(kit, W - 0.3, 3.6, D - 0.3, [0, 0.2, 0]);
  return kit.build("building.undertaker");
}

// --- Water tower ---------------------------------------------------------------------------------------------

export function buildWaterTower(): BuiltBuilding {
  const kit = new Kit();
  const legH = 5.2;
  const base = 1.5;
  const topHalf = 1.15;
  // Four splayed legs with X bracing on every side.
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;
  for (const [sx, sz] of corners) {
    const from = new Vector3(sx * base, 0, sz * base);
    const to = new Vector3(sx * topHalf, legH, sz * topHalf);
    const leg = sweep({ path: [from, to], rings: [{ w: 0.11, f: 0.11, b: 0.11, p: 6 }, { w: 0.1, f: 0.1, b: 0.1, p: 6 }], front: new Vector3(0, 0, 1), radial: 4, capStart: true, capEnd: true });
    kit.add(leg.geometry, "wood", "#5a4030");
  }
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i] as readonly [number, number];
    const [bx, bz] = corners[(i + 1) % 4] as readonly [number, number];
    for (const [y0, y1] of [[0.3, 2.6], [2.6, 4.9]] as const) {
      const at = (y: number, sx: number, sz: number) => {
        const t = y / legH;
        const h = base + (topHalf - base) * t;
        return new Vector3(sx * h, y, sz * h);
      };
      for (const [p, q] of [[at(y0, ax, az), at(y1, bx, bz)], [at(y0, bx, bz), at(y1, ax, az)]] as const) {
        const brace = sweep({ path: [p, q], rings: [{ w: 0.05, f: 0.025, b: 0.025, p: 6 }, { w: 0.05, f: 0.025, b: 0.025, p: 6 }], front: new Vector3(0, 1, 0), radial: 4 });
        kit.add(brace.geometry, "wood", "#6a4c34");
      }
    }
  }
  // Platform, then the tank: staves, iron hoops, a conical shingled roof.
  for (let x = -1.45; x <= 1.45; x += 0.155) kit.plank(mat([x, legH + 0.02, 0], [0, Math.PI / 2, 0], [3.0, 0.145, 1]), tint("#7a5a3a", kit.next(), 0.15), "wood");
  const R = 1.35;
  const staves = 40;
  for (let i = 0; i < staves; i++) {
    const a = (i / staves) * Math.PI * 2;
    kit.plank(mat([Math.cos(a) * R, legH + 0.1 + 1.3, Math.sin(a) * R], [0, -a + Math.PI / 2, Math.PI / 2], [2.6, (2 * Math.PI * R) / staves + 0.01, 1.4]), tint("#7e5c3c", i, 0.12), "wood");
  }
  for (const y of [0.25, 0.9, 1.6, 2.35]) kit.add(lathe([[R + 0.025, 0], [R + 0.045, 0], [R + 0.045, 0.05], [R + 0.025, 0.05]], 32), "steel", "#2e2a26", mat([0, legH + 0.1 + y, 0]));
  kit.add(lathe([[0, 0], [R + 0.25, 0], [R + 0.22, 0.06], [0.15, 0.85], [0.08, 0.95], [0, 0.97]], 32), "wood", "#5a4636", mat([0, legH + 2.75, 0]));
  kit.add(lathe([[0, 0], [R + 0.02, 0], [R + 0.02, 0.05], [0, 0.05]], 32), "wood", "#4a3424", mat([0, legH + 2.72, 0]));
  // Ladder up one leg and a spout with its chain.
  const ladderFrom = new Vector3(0.25, 0, base + 0.2);
  const ladderTo = new Vector3(0.25, legH + 0.1, topHalf + 0.15);
  for (const dx of [-0.25, 0.25]) {
    const rail = sweep({ path: [ladderFrom.clone().add(new Vector3(dx, 0, 0)), ladderTo.clone().add(new Vector3(dx, 0, 0))], rings: [{ w: 0.03, f: 0.03, b: 0.03 }, { w: 0.03, f: 0.03, b: 0.03 }], front: new Vector3(0, 0, 1), radial: 5 });
    kit.add(rail.geometry, "wood", "#6a4c34");
  }
  for (let i = 1; i < 17; i++) {
    const p = ladderFrom.clone().lerp(ladderTo, i / 17);
    kit.add(lathe([[0.018, -0.25], [0.018, 0.25], [0, 0.25]], 5), "wood", "#6a4c34", mat([p.x, p.y, p.z], [0, 0, Math.PI / 2]));
  }
  const spout = sweep({
    path: [new Vector3(-R, legH + 0.5, 0), new Vector3(-R - 0.5, legH + 0.45, 0), new Vector3(-R - 0.85, legH + 0.2, 0), new Vector3(-R - 1.0, legH - 0.2, 0)],
    rings: [{ w: 0.09, f: 0.09, b: 0.09 }, { w: 0.09, f: 0.09, b: 0.09 }, { w: 0.09, f: 0.09, b: 0.09 }, { w: 0.11, f: 0.11, b: 0.11 }],
    front: new Vector3(0, 0, 1),
    radial: 8,
    samples: 10,
  });
  kit.add(spout.geometry, "steel", "#3a3632");
  return kit.build("building.water_tower");
}

// --- Stagecoach stop -----------------------------------------------------------------------------------------

export function buildStagecoachStop(): BuiltBuilding {
  const kit = new Kit();
  const W = 6;
  const D = 4;
  const PAINT = "#8f7350";
  const b = back(D);
  // An open shelter: back and side walls, a roof on front posts, a bench and luggage.
  siding(kit, b, { x0: -W / 2, x1: W / 2, y0: 0, y1: 3.0, color: PAINT, style: "batten" });
  backing(kit, b, W, 3.0, [], "#3e3020");
  for (const fr of [right(W), left(W)]) {
    siding(kit, fr, { x0: -D / 2, x1: D / 2, y0: 0, y1: 1.4, color: PAINT, style: "batten" });
    backing(kit, fr, D, 1.4, [], "#3e3020");
  }
  for (let x = -W / 2 + 0.08; x < W / 2; x += 0.155) kit.plank(mat([x, 0.2, 0], [0, Math.PI / 2, 0], [D, 0.145, 1]), tint("#8a6a4a", kit.next(), 0.14), "wood");
  kit.add(extrude(roundedRect(W + 0.1, 0.25, 0.01), D, undefined, 2), "wood", "#5e4a36", mat([0, 0.05, 0]));
  // Roof slopes from the back wall down to the front.
  const rf = mat([0, 0, -D / 2]);
  awning(kit, rf, -W / 2, W / 2, D + 0.3, 3.4, 4, PAINT, 0.2);
  // Bench along the back wall.
  for (const [y, z, h, d] of [[0.65, 0.3, 0.05, 0.42], [1.05, 0.08, 0.22, 0.04]] as const) kit.add(extrude(roundedRect(3.4, h, 0.01), d, { size: 0.008 }), "wood", "#6a4a30", mat([0, y, -D / 2 + z + 0.1]));
  for (const x of [-1.5, 0, 1.5]) kit.add(extrude(roundedRect(0.06, 0.45, 0.01, 0, 0.22), 0.4, { size: 0.006 }), "wood", "#5a3e28", mat([x, 0.2, -D / 2 + 0.35]));
  // Hanging sign under the roof edge, on two chains.
  kit.sign("STAGECOACH", 2.6, 0.42, mat([0, 2.2, D / 2 - 0.02]), { ground: "#e6d6ae", ink: "#4a2410" });
  kit.add(extrude(roundedRect(2.8, 0.6, 0.03), 0.06, { size: 0.01 }), "paint", "#3e2a18", mat([0, 2.2, D / 2 - 0.07]));
  for (const x of [-1.2, 1.2]) kit.add(lathe([[0.01, 0], [0.01, 0.4], [0, 0.4]], 4), "steel", "#2e2a26", mat([x, 2.5, D / 2 - 0.05]));
  // Trunks with straps and brass corners.
  const trunk = extrude(roundedRect(0.9, 0.5, 0.06, 0, 0.25), 0.55, { size: 0.02 }, 3);
  for (const [x, y, z, r, s] of [[1.9, 0.2, -0.8, 0.2, 1], [1.95, 0.72, -0.85, -0.1, 0.75], [-2.2, 0.2, -1.0, 0.5, 0.85]] as const) {
    kit.add(trunk, "leather", tint("#5a3a24", Math.round(x * 10), 0.15), mat([x, y, z], [0, r, 0], s));
    for (const dx of [-0.28, 0.28]) kit.add(extrude(roundedRect(0.07, 0.52, 0.01, 0, 0.26), 0.57), "leather", "#2a1c12", mat([x + dx * s * Math.cos(r), y - 0.005, z - dx * s * Math.sin(r)], [0, r, 0], s));
  }
  return kit.build("building.stagecoach_stop");
}

// --- Shared props used here and elsewhere --------------------------------------------------------------------

/** Plank crate: a box of boards with corner battens and a lid (0.7 m). */
export function crateGeometry(): ReturnType<typeof extrude> {
  return extrude(roundedRect(0.7, 0.62, 0.03, 0, 0.31), 0.6, { size: 0.02, segments: 1 }, 2);
}

export function barrelGeometry(): ReturnType<typeof lathe> {
  return lathe([[0, 0], [0.26, 0], [0.3, 0.2], [0.32, 0.42], [0.3, 0.64], [0.26, 0.84], [0, 0.84]], 16);
}

export function sackGeometry(): ReturnType<typeof lathe> {
  return lathe([[0, 0], [0.2, 0.02], [0.24, 0.15], [0.22, 0.38], [0.12, 0.5], [0.06, 0.56], [0, 0.58]], 10);
}

export function baleGeometry(): ReturnType<typeof extrude> {
  return extrude(roundedRect(1.0, 0.42, 0.08, 0, 0.21), 0.55, { size: 0.03, segments: 2 }, 3);
}

export function coffinGeometry(): ReturnType<typeof extrude> {
  // Classic toe-pincher outline, standing upright.
  return extrude(polygon([[0, 0], [0.22, 0.05], [0.33, 1.45], [0.2, 1.95], [-0.2, 1.95], [-0.33, 1.45], [-0.22, 0.05]]), 0.32, { size: 0.02 }, 2);
}
