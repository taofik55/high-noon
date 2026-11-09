// World layout of the town square (docs/05 §2). 1 unit = 1 m, y up. The local player sits at the front (+z), facing
// the center; the camera looks over their shoulder.

export type Vec3 = [number, number, number];

export const SEAT_RADIUS = 6;

/**
 * Seats go clockwise around the ring as seen from above, matching the table order (docs/02 §3): the next seat
 * clockwise is the one on my left, i.e. towards −x from the camera's point of view (the same as the 2D table).
 */
export function seatPosition(seat: number, mySeat: number, playerCount: number, radius = SEAT_RADIUS): Vec3 {
  const r = (seat - mySeat + playerCount) % playerCount;
  const angle = Math.PI / 2 + (r * 2 * Math.PI) / playerCount;
  return [round(radius * Math.cos(angle)), 0, round(radius * Math.sin(angle))];
}

/** Y rotation that turns a model facing +z towards the center of the square. */
export function facingCenter([x, , z]: Vec3): number {
  return Math.atan2(-x, -z);
}

/** A point `distance` m from `p` towards the center (the seat's crate). */
export function towardsCenter([x, y, z]: Vec3, distance: number): Vec3 {
  const len = Math.hypot(x, z) || 1;
  return [round(x - (x / len) * distance), y, round(z - (z / len) * distance)];
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export interface CameraPose {
  position: Vec3;
  target: Vec3;
}

/** TABLE mode: elevated 3/4 view of the whole ring from behind my seat (docs/05 §3). */
export const TABLE_CAMERA: CameraPose = { position: [0, 8.5, 13.5], target: [0, 0.4, -0.8] };

/**
 * TABLE view for a screen aspect: on narrow (portrait) screens the camera backs off along its view line so the side
 * seats stay in frame; landscape screens get TABLE_CAMERA as is.
 */
export function tableCamera(aspect: number): CameraPose {
  const k = aspect >= 1.3 ? 1 : Math.min(2.1, 1.3 / Math.max(0.1, aspect));
  if (k === 1) return TABLE_CAMERA;
  const [px, py, pz] = TABLE_CAMERA.position;
  const [tx, ty, tz] = TABLE_CAMERA.target;
  return { position: [round(tx + (px - tx) * k), round(ty + (py - ty) * k), round(tz + (pz - tz) * k)], target: TABLE_CAMERA.target };
}

/** FOCUS mode: dolly part of the way towards a seat and look at the character. */
export function focusCamera(seatPos: Vec3): CameraPose {
  const [x, , z] = seatPos;
  const [cx, cy, cz] = TABLE_CAMERA.position;
  const k = 0.45;
  return {
    position: [round(cx + (x - cx) * k), round(cy - 2.5), round(cz + (z - cz) * k)],
    target: [x, 1.2, z],
  };
}

export interface Building {
  id: string;
  /** Sign text; buildings are cinematic set pieces later (docs/05 §2). */
  label: string;
  position: Vec3;
  size: Vec3;
  color: string;
  rotationY: number;
}

/** Placeholder town per the map in docs/05 §2: box buildings around a square of ~14 m radius. */
export const BUILDINGS: readonly Building[] = [
  { id: "building.saloon", label: "SALOON", position: [-7, 0, -17], size: [9, 6, 6], color: "#8a5a35", rotationY: 0 },
  { id: "building.sheriff", label: "SHERIFF · JAIL", position: [7, 0, -17], size: [8, 4.5, 6], color: "#7a6a55", rotationY: 0 },
  { id: "building.bank", label: "WELLS FARGO", position: [-17, 0, -6], size: [6, 5, 8], color: "#9c8a6c", rotationY: Math.PI / 2 },
  { id: "building.store", label: "GENERAL STORE", position: [17, 0, -6], size: [6, 4.5, 8], color: "#a0683f", rotationY: -Math.PI / 2 },
  { id: "building.stable", label: "STABLE", position: [-17, 0, 9], size: [7, 4, 9], color: "#6e4a2e", rotationY: Math.PI / 2 },
  { id: "building.undertaker", label: "UNDERTAKER", position: [17, 0, 9], size: [5, 4, 6], color: "#4f4a45", rotationY: -Math.PI / 2 },
  { id: "building.water_tower", label: "", position: [-9, 0, 20], size: [3, 8, 3], color: "#7d5b3a", rotationY: 0 },
  { id: "building.stagecoach_stop", label: "STAGECOACH", position: [9, 0, 21], size: [6, 3.5, 4], color: "#8f7350", rotationY: Math.PI },
];

/** Distant mesas for the desert backdrop. */
export const MESAS: readonly { position: Vec3; radius: number; height: number }[] = [
  { position: [-60, 0, -90], radius: 18, height: 22 },
  { position: [-15, 0, -110], radius: 26, height: 30 },
  { position: [45, 0, -95], radius: 20, height: 18 },
  { position: [95, 0, -40], radius: 16, height: 14 },
  { position: [-100, 0, -20], radius: 22, height: 20 },
];

export const SEAT_TINTS: readonly string[] = ["#d9a441", "#b5523b", "#4f7cac", "#5e8c4a", "#8a5fa8", "#c7743a", "#3f8f8a"];
