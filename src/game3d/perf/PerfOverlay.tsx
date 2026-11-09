"use client";

import { usePerf } from "./perfStats";

/** Dev overlay (docs/05 §9 budget: 60 fps, ≤ 400 draw calls in TABLE view). */
export function PerfOverlay() {
  const s = usePerf((p) => p.stats);
  return (
    <div data-testid="perf-overlay" className="pointer-events-none absolute bottom-2 left-2 z-40 rounded bg-black/70 px-2 py-1 font-mono text-[11px] leading-tight text-lime-300">
      <div>{s.fps} fps</div>
      <div className={s.drawCalls > 400 ? "text-red-400" : undefined}>{s.drawCalls} draws</div>
      <div>{(s.triangles / 1000).toFixed(0)}k tris</div>
      <div>
        {s.geometries} geo · {s.textures} tex · {s.programs} prog
      </div>
    </div>
  );
}
