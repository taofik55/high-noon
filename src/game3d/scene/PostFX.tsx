"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Bloom, DepthOfField, EffectComposer, Noise, SSAO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode, type DepthOfFieldEffect } from "postprocessing";
import { Vector3 } from "three";
import type { PostConfig } from "../settings/quality";

interface Controls {
  getTarget?: (out: Vector3) => Vector3;
}

/**
 * Post-processing per preset (docs/05 §7–8): tone mapping and bloom from medium, SSAO and vignette from high,
 * depth of field during cinematics and film grain on ultra. Bloom only catches HDR highlights (muzzle flashes,
 * explosions, sparks render above 1.0), not the sunlit town.
 */
export function PostFX({ config, cinematic }: { config: PostConfig; cinematic: boolean }) {
  const dof = useRef<DepthOfFieldEffect>(null);
  useFrame(({ controls }) => {
    // Focus where the Director's camera looks (CameraControls target).
    const c = controls as Controls | null;
    if (dof.current?.target && c?.getTarget) c.getTarget(dof.current.target);
  });
  const dofOn = config.cinematicDof && cinematic;
  return (
    <EffectComposer multisampling={config.multisampling} enableNormalPass={config.ssao}>
      {config.ssao && <SSAO samples={16} radius={0.08} intensity={18} luminanceInfluence={0.6} worldDistanceThreshold={40} worldDistanceFalloff={10} worldProximityThreshold={0.6} worldProximityFalloff={0.3} />}
      {dofOn && <DepthOfField ref={dof} target={[0, 1, 0]} focalLength={0.04} bokehScale={3} />}
      {config.bloom && <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.9} />}
      {config.vignette && <Vignette offset={0.3} darkness={0.55} />}
      {config.grain && <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.18} />}
      {/* ACES, like the renderer without a composer (R3F default), so every preset has the same look. */}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
