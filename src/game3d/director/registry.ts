"use client";

import type { Seat } from "@/engine";
import type { CameraApi, RigApi, VfxApi } from "./types";

// Where scene components plug their imperative handles in for the Director (which lives outside React).

const rigs = new Map<Seat, RigApi>();
let vfx: VfxApi | null = null;
let camera: (CameraApi & { home(duration: number): ReturnType<CameraApi["shot"]> }) | null = null;

export function registerRig(seat: Seat, rig: RigApi): () => void {
  rigs.set(seat, rig);
  return () => {
    if (rigs.get(seat) === rig) rigs.delete(seat);
  };
}

export function getRig(seat: Seat): RigApi | null {
  return rigs.get(seat) ?? null;
}

export function allRigs(): RigApi[] {
  return [...rigs.values()];
}

export function registerVfx(api: VfxApi): () => void {
  vfx = api;
  return () => {
    if (vfx === api) vfx = null;
  };
}

export function getVfx(): VfxApi | null {
  return vfx;
}

export function registerCamera(api: NonNullable<typeof camera>): () => void {
  camera = api;
  return () => {
    if (camera === api) camera = null;
  };
}

export function getCamera(): typeof camera {
  return camera;
}
