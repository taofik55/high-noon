"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import type { Vec3 } from "../world/layout";
import { useSettings } from "../settings/settingsStore";
import { audio } from "./engine";

/**
 * Mounts the game's audio inside the Canvas (docs/05 §10): the listener follows the camera, volumes follow the
 * settings, and the town music plays while the table is open. Audio unlocks on the first click or key press.
 */
export function AudioLayer() {
  const dir = useRef(new Vector3());
  const pos = useRef<Vec3>([0, 0, 0]);
  const fwd = useRef<Vec3>([0, 0, -1]);

  useEffect(() => {
    audio.setVolumes(useSettings.getState().volume);
    const unsub = useSettings.subscribe((s, prev) => {
      if (s.volume !== prev.volume) audio.setVolumes(s.volume);
    });
    const unlock = () => audio.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    audio.startMusic();
    return () => {
      unsub();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      audio.stopMusic();
    };
  }, []);

  useFrame(({ camera }) => {
    if (!audio.ready) return;
    camera.getWorldDirection(dir.current);
    // Reused tuples: no allocations per frame.
    const p = pos.current;
    const f = fwd.current;
    p[0] = camera.position.x;
    p[1] = camera.position.y;
    p[2] = camera.position.z;
    f[0] = dir.current.x;
    f[1] = dir.current.y;
    f[2] = dir.current.z;
    audio.setListener(p, f);
  });

  return null;
}
