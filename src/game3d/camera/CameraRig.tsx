"use client";

import { useEffect, useRef, type ComponentRef } from "react";
import { CameraControls } from "@react-three/drei";
import { TABLE_CAMERA, focusCamera, type CameraPose, type Vec3 } from "../world/layout";

interface CameraRigProps {
  /** Seat position to dolly towards (FOCUS), or null for the TABLE view. */
  focus: Vec3 | null;
  /** Dev-only FREE mode: orbit with the mouse. */
  free: boolean;
}

/**
 * docs/05 §3: TABLE by default, FOCUS while picking a target and hovering a valid one, FREE in dev. Smooth transitions
 * through CameraControls.setLookAt(…, true); CINEMATIC arrives with the Director in Phase 8.
 */
export function CameraRig({ focus, free }: CameraRigProps) {
  const controls = useRef<ComponentRef<typeof CameraControls>>(null);
  const fx = focus?.[0];
  const fz = focus?.[2];

  useEffect(() => {
    const c = controls.current;
    if (!c || free) return;
    const pose: CameraPose = fx !== undefined && fz !== undefined ? focusCamera([fx, 0, fz]) : TABLE_CAMERA;
    void c.setLookAt(...pose.position, ...pose.target, true);
  }, [fx, fz, free]);

  return <CameraControls ref={controls} makeDefault enabled={free} smoothTime={0.35} />;
}
