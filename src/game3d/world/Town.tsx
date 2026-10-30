"use client";

import { useMemo } from "react";
import { Sky } from "@react-three/drei";
import { CanvasTexture, SRGBColorSpace } from "three";
import { BUILDINGS, MESAS, type Building } from "./layout";

const SUN: [number, number, number] = [30, 42, 18];

function signTexture(text: string): CanvasTexture | null {
  if (!text) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#3a2717";
  ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = "#d9a441";
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 504, 88);
  ctx.fillStyle = "#f3d58c";
  ctx.font = "bold 52px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 50, 480);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function BuildingBox({ b }: { b: Building }) {
  const [w, h, d] = b.size;
  const sign = useMemo(() => signTexture(b.label), [b.label]);
  return (
    <group position={b.position} rotation={[0, b.rotationY, 0]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={b.color} roughness={0.95} />
      </mesh>
      {/* Overhanging roof */}
      <mesh position={[0, h + 0.15, 0]} castShadow>
        <boxGeometry args={[w + 0.6, 0.3, d + 0.6]} />
        <meshStandardMaterial color="#4a3324" roughness={1} />
      </mesh>
      {/* Porch roof on the square side (+z after rotation) */}
      <mesh position={[0, h * 0.55, d / 2 + 0.9]} castShadow>
        <boxGeometry args={[w, 0.12, 1.8]} />
        <meshStandardMaterial color="#5c4030" roughness={1} />
      </mesh>
      {sign && (
        <mesh position={[0, h * 0.8, d / 2 + 0.02]}>
          <planeGeometry args={[Math.min(w * 0.85, 6), Math.min(w * 0.85, 6) * (96 / 512)]} />
          <meshStandardMaterial map={sign} roughness={0.8} />
        </mesh>
      )}
    </group>
  );
}

function Cactus({ position, scale }: { position: [number, number, number]; scale: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.32, 2.4, 10]} />
        <meshStandardMaterial color="#4f7a3a" roughness={0.9} />
      </mesh>
      <mesh position={[0.45, 1.4, 0]} rotation={[0, 0, -0.2]} castShadow>
        <cylinderGeometry args={[0.16, 0.18, 1.0, 8]} />
        <meshStandardMaterial color="#4f7a3a" roughness={0.9} />
      </mesh>
    </group>
  );
}

const CACTI: { position: [number, number, number]; scale: number }[] = [
  { position: [-26, 0, 18], scale: 1.1 },
  { position: [28, 0, 22], scale: 0.9 },
  { position: [-32, 0, -24], scale: 1.3 },
  { position: [34, 0, -20], scale: 1 },
  { position: [22, 0, 30], scale: 0.8 },
  { position: [-20, 0, 32], scale: 1.2 },
];

/** The placeholder town square at high noon / golden hour (docs/05 §1–2, §7). */
export function Town({ shadows, shadowMapSize }: { shadows: boolean; shadowMapSize: number }) {
  return (
    <>
      <Sky sunPosition={SUN} turbidity={6} rayleigh={1.2} mieCoefficient={0.006} mieDirectionalG={0.85} />
      <fog attach="fog" args={["#e8c99a", 40, 180]} />
      <hemisphereLight args={["#ffe9c4", "#7a5a3a", 0.75]} />
      <directionalLight
        position={SUN}
        intensity={2.2}
        color="#ffe2b0"
        castShadow={shadows}
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-camera-far={120}
        shadow-bias={-0.0004}
      />

      {/* Desert floor and the packed-earth square */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#d2a86e" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[11, 48]} />
        <meshStandardMaterial color="#b98c58" roughness={1} />
      </mesh>

      {BUILDINGS.map((b) => (
        <BuildingBox key={b.id} b={b} />
      ))}
      {CACTI.map((c, i) => (
        <Cactus key={i} {...c} />
      ))}
      {MESAS.map((m, i) => (
        <mesh key={i} position={[m.position[0], m.height / 2, m.position[2]]}>
          <cylinderGeometry args={[m.radius * 0.8, m.radius, m.height, 7]} />
          <meshStandardMaterial color="#b06a45" roughness={1} />
        </mesh>
      ))}
    </>
  );
}
