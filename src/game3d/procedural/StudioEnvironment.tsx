"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { PMREMGenerator } from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { material, type MaterialKey } from "./materials";

/**
 * A procedural environment map (three's RoomEnvironment through PMREM): metals need something to reflect or they
 * render black. Generated in the browser, no HDR download. With `only`, it is set on those shared materials instead
 * of the whole scene, so cloth and wood (most of the screen) skip the extra per-pixel lookups.
 */
export function StudioEnvironment({ intensity = 0.45, only }: { intensity?: number; only?: readonly MaterialKey[] }) {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { gl, scene } = get();
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    const mats = only?.map((k) => material(k)) ?? [];
    if (only) {
      for (const m of mats) {
        m.envMap = env;
        m.envMapIntensity = intensity * 2;
        m.needsUpdate = true;
      }
    } else {
      scene.environment = env;
      scene.environmentIntensity = intensity;
    }
    return () => {
      if (only) {
        for (const m of mats) {
          m.envMap = null;
          m.needsUpdate = true;
        }
      } else scene.environment = null;
      env.dispose();
      pmrem.dispose();
      room.dispose();
    };
  }, [get, intensity, only]);
  return null;
}
