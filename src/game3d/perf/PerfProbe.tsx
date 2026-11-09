"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { registerTestProvider } from "../testHook";
import { usePerf } from "./perfStats";

/**
 * Counts what each frame costs. `gl.info` normally resets on every render call, which would only show the last pass
 * once post-processing renders several; so it is reset here, once per frame, before the scene renders.
 */
export function PerfProbe() {
  // Read through get(): the renderer is mutated here (autoReset), which hook values must not be.
  const get = useThree((s) => s.get);
  const acc = useRef({ frames: 0, since: 0, calls: 0, triangles: 0 });

  useEffect(() => {
    const { gl } = get();
    gl.info.autoReset = false;
    const off = registerTestProvider("perf", () => usePerf.getState().stats);
    return () => {
      gl.info.autoReset = true;
      off();
    };
  }, [get]);

  useFrame(({ clock, gl }) => {
    const a = acc.current;
    const info = gl.info;
    // The counters now hold the previous frame.
    if (info.render.frame > 0) {
      a.frames++;
      a.calls += info.render.calls;
      a.triangles += info.render.triangles;
    }
    info.reset();
    const now = clock.elapsedTime;
    if (now - a.since >= 0.25 && a.frames > 0) {
      usePerf.getState().set({
        fps: Math.round(a.frames / (now - a.since)),
        drawCalls: Math.round(a.calls / a.frames),
        triangles: Math.round(a.triangles / a.frames),
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        programs: info.programs?.length ?? 0,
      });
      a.frames = 0;
      a.calls = 0;
      a.triangles = 0;
      a.since = now;
    }
  }, -1000);

  return null;
}
