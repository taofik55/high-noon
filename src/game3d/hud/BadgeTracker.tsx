"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import type { Vec3 } from "../world/layout";
import { badgeElement } from "./badgeAnchors";

const BADGE_HEIGHT = 2.75;

/** Projects each seat's name-plate anchor to the screen and moves the DOM badge there (no React updates). */
export function BadgeTracker({ positions }: { positions: { seat: number; pos: Vec3 }[] }) {
  const v = useRef(new Vector3());
  useFrame(({ camera, size }) => {
    for (const { seat, pos } of positions) {
      const el = badgeElement(seat);
      if (!el) continue;
      v.current.set(pos[0], BADGE_HEIGHT, pos[2]).project(camera);
      const behind = v.current.z > 1;
      const x = ((v.current.x + 1) / 2) * size.width;
      const y = ((1 - v.current.y) / 2) * size.height;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      el.style.visibility = behind ? "hidden" : "visible";
    }
  });
  return null;
}
