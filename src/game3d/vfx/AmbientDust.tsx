"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, type Points } from "three";

const FULL = 700;
const AREA = 34;

function softDot(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,240,210,1)");
  g.addColorStop(1, "rgba(255,240,210,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new CanvasTexture(c);
}

/**
 * Dust motes and blown sand drifting through the square (docs/05 §7): one Points draw call, positions moved in place
 * every frame (no allocations). `amount` is the preset's particle share.
 */
export function AmbientDust({ amount }: { amount: number }) {
  const count = Math.max(0, Math.round(FULL * amount));
  const points = useRef<Points>(null);
  const { geometry, seeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    // Deterministic scatter: the scene looks the same each visit.
    let r = 1234567;
    const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rand() - 0.5) * AREA * 2;
      pos[i * 3 + 1] = 0.1 + rand() * rand() * 5;
      pos[i * 3 + 2] = (rand() - 0.5) * AREA * 2;
      seeds[i] = rand() * 100;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(pos, 3));
    return { geometry, seeds };
  }, [count]);
  const map = useMemo(() => softDot(), []);

  useFrame(({ clock }, dt) => {
    const attr = geometry.getAttribute("position") as BufferAttribute;
    const a = attr.array as Float32Array;
    const t = clock.elapsedTime;
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) {
      const s = seeds[i] as number;
      // A steady breeze along -x with gusts, a little bob; wrap around the square.
      a[i * 3] = (a[i * 3] as number) - step * (1.2 + Math.sin(t * 0.7 + s) * 0.8);
      a[i * 3 + 1] = Math.max(0.05, (a[i * 3 + 1] as number) + Math.sin(t * 1.3 + s * 2) * step * 0.15);
      a[i * 3 + 2] = (a[i * 3 + 2] as number) + Math.cos(t * 0.5 + s) * step * 0.3;
      if ((a[i * 3] as number) < -AREA) a[i * 3] = AREA;
    }
    attr.needsUpdate = true;
  });

  if (count === 0) return null;
  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <pointsMaterial map={map ?? undefined} size={0.09} sizeAttenuation transparent opacity={0.55} depthWrite={false} blending={AdditiveBlending} color="#e8c99a" />
    </points>
  );
}
