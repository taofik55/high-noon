"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { governorStep, initialGovernor } from "../settings/quality";
import { useSettings } from "../settings/settingsStore";

/** Runs the "auto" quality governor (docs/05 §8): one level down after 3 s under 50 fps. */
export function AutoQuality() {
  const g = useRef(initialGovernor());
  useFrame((_, dt) => {
    const s = useSettings.getState();
    if (s.quality !== "auto") {
      g.current = initialGovernor();
      return;
    }
    const { next, stepDown } = governorStep(g.current, dt);
    g.current = next;
    if (stepDown) s.degradeAuto();
  });
  return null;
}
