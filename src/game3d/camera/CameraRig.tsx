"use client";

import { useEffect, useRef, type ComponentRef } from "react";
import { CameraControls } from "@react-three/drei";
import gsap from "gsap";
import { Vector3 } from "three";
import { registerCamera } from "../director/registry";
import { reducedMotion } from "../settings/settingsStore";
import type { Timeline } from "../director/types";
import { TABLE_CAMERA, focusCamera, type CameraPose, type Vec3 } from "../world/layout";

interface CameraRigProps {
  /** Seat position to dolly towards (FOCUS), or null for the TABLE view. */
  focus: Vec3 | null;
  /** Dev-only FREE mode: orbit with the mouse. */
  free: boolean;
  /** The Director is running a CINEMATIC shot: leave the camera alone. */
  cinematic: boolean;
}

/**
 * docs/05 §3: TABLE by default, FOCUS while picking a target and hovering a valid one, CINEMATIC while the Director
 * runs a scene (it drives the camera through the handle registered here), FREE in dev.
 */
export function CameraRig({ focus, free, cinematic }: CameraRigProps) {
  const controls = useRef<ComponentRef<typeof CameraControls>>(null);
  const fx = focus?.[0];
  const fz = focus?.[2];

  useEffect(() => {
    const c = controls.current;
    if (!c || free || cinematic) return;
    const pose: CameraPose = fx !== undefined && fz !== undefined ? focusCamera([fx, 0, fz]) : TABLE_CAMERA;
    // Reduced motion: cut instead of dollying.
    void c.setLookAt(...pose.position, ...pose.target, !reducedMotion());
  }, [fx, fz, free, cinematic]);

  // Scripted shots for the Director: GSAP drives the controls so a scene can be skipped (progress(1)) or sped up.
  useEffect(() => {
    const shot = (pose: CameraPose, duration: number): Timeline => {
      const tl = gsap.timeline();
      const from = { p: new Vector3(), t: new Vector3() };
      const k = { v: 0 };
      tl.to(k, {
        v: 1,
        duration,
        ease: "power2.inOut",
        onStart: () => {
          controls.current?.getPosition(from.p);
          controls.current?.getTarget(from.t);
        },
        onUpdate: () => {
          const c = controls.current;
          if (!c) return;
          const p = from.p.clone().lerp(new Vector3(...pose.position), k.v);
          const t = from.t.clone().lerp(new Vector3(...pose.target), k.v);
          void c.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, false);
        },
      });
      return tl;
    };
    const shake = (strength: number, duration: number): Timeline => {
      const tl = gsap.timeline();
      if (reducedMotion()) return tl;
      const steps = Math.max(2, Math.round(duration / 0.05));
      for (let i = 0; i < steps; i++) {
        const s = strength * (1 - i / steps);
        tl.call(() => void controls.current?.setFocalOffset((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, 0, false));
        tl.to({}, { duration: duration / steps });
      }
      tl.call(() => void controls.current?.setFocalOffset(0, 0, 0, false));
      return tl;
    };
    return registerCamera({ shot, shake, home: (d) => shot(TABLE_CAMERA, d) });
  }, []);

  return <CameraControls ref={controls} makeDefault enabled={free} smoothTime={0.35} />;
}
