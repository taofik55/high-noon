"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { CAMERA_PRESETS, type AssetId, type AssetStats, type CameraPreset } from "./AssetViewer";
import { ASSET_LIST } from "./assetList";
import { CHARACTER_IDS, CHARACTERS, type CharacterId } from "@/engine";

// three.js must never render on the server.
const AssetViewer = dynamic(() => import("./AssetViewer").then((m) => m.AssetViewer), { ssr: false });

/** /dev/assets: inspect each procedural asset (shape, clips, triangle and draw-call budget). Developer tool. */
export function AssetsPage() {
  const [asset, setAsset] = useState<AssetId>("cowboy");
  const [clip, setClip] = useState("Idle");
  const [clips, setClips] = useState<string[]>([]);
  const [playing, setPlaying] = useState(true);
  const [gunInHand, setGunInHand] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [lod, setLod] = useState<0 | 1>(0);
  const [stats, setStats] = useState<AssetStats | null>(null);
  const [view, setView] = useState<CameraPreset>("threeQuarter");
  const [character, setCharacter] = useState<CharacterId | "master">("master");
  const onStats = useCallback((s: AssetStats) => setStats(s), []);
  const onClips = useCallback((names: string[]) => setClips(names), []);

  return (
    <div className="fixed inset-0 flex bg-stone-950 text-amber-50">
      <aside className="z-10 flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-stone-800 bg-stone-900 p-4 text-sm">
        <h1 className="text-lg font-bold tracking-widest text-amber-400 uppercase">Assets</h1>
        <div className="flex flex-col gap-1">
          {ASSET_LIST.map((a) => (
            <button
              key={a.id}
              type="button"
              data-testid={`asset-${a.id}`}
              onClick={() => setAsset(a.id)}
              className={`rounded px-3 py-1.5 text-left ${asset === a.id ? "bg-amber-500 font-semibold text-stone-950" : "bg-stone-800 hover:bg-stone-700"}`}
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1">
          {CAMERA_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              data-testid={`view-${p.id}`}
              onClick={() => setView(p.id)}
              className={`rounded px-2 py-1 text-xs ${view === p.id ? "bg-amber-600 text-stone-950" : "bg-stone-800 hover:bg-stone-700"}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {asset === "horse" && (
          <label className="flex items-center justify-between gap-2">
            Langkah
            <select data-testid="gait" className="rounded bg-stone-800 px-1 py-0.5" value={clip} onChange={(e) => setClip(e.target.value)}>
              {clips.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        )}
        {asset === "cowboy" && (
          <div className="flex flex-col gap-2">
            <label className="flex items-center justify-between gap-2">
              Karakter
              <select
                data-testid="character"
                className="rounded bg-stone-800 px-1 py-0.5"
                value={character}
                onChange={(e) => setCharacter(e.target.value as CharacterId | "master")}
              >
                <option value="master">Cowboy (master)</option>
                {CHARACTER_IDS.map((id) => (
                  <option key={id} value={id}>
                    {CHARACTERS[id].name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between gap-2">
              Clip
              <select data-testid="clip" className="rounded bg-stone-800 px-1 py-0.5" value={clip} onChange={(e) => setClip(e.target.value)}>
                {clips.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={playing} onChange={(e) => setPlaying(e.target.checked)} /> Putar
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" data-testid="gun-in-hand" checked={gunInHand} onChange={(e) => setGunInHand(e.target.checked)} /> Revolver di tangan
            </label>
          </div>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" data-testid="wireframe" checked={wireframe} onChange={(e) => setWireframe(e.target.checked)} /> Wireframe
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" data-testid="lod1" checked={lod === 1} onChange={(e) => setLod(e.target.checked ? 1 : 0)} /> LOD1 (jarak jauh)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} /> Putar otomatis
        </label>

        {stats && (
          <dl className="grid grid-cols-2 gap-x-2 gap-y-1 rounded border border-stone-700 p-2 text-xs" data-testid="asset-stats">
            <dt className="text-stone-400">Segitiga</dt>
            <dd data-testid="stat-triangles">{stats.triangles.toLocaleString("id-ID")}</dd>
            <dt className="text-stone-400">Draw call</dt>
            <dd data-testid="stat-drawcalls">{stats.drawCalls}</dd>
            <dt className="text-stone-400">Mesh (instanced)</dt>
            <dd>
              {stats.meshes} ({stats.instanced})
            </dd>
            <dt className="text-stone-400">Bone</dt>
            <dd>{stats.bones}</dd>
            <dt className="col-span-2 mt-1 text-stone-400">Material</dt>
            <dd className="col-span-2">{stats.materials.join(", ")}</dd>
            <dt className="col-span-2 mt-1 text-stone-400">Tekstur</dt>
            <dd className="col-span-2">{stats.textures.length ? stats.textures.join(", ") : "—"}</dd>
          </dl>
        )}
        <p className="text-xs text-stone-500">Draw call termasuk lantai pratinjau (1) dan bayangan.</p>
      </aside>
      <main className="relative flex-1">
        <AssetViewer asset={asset} character={character} view={view} clip={clip} playing={playing} gunInHand={gunInHand} wireframe={wireframe} autoRotate={autoRotate} lod={lod} onStats={onStats} onClips={onClips} />
      </main>
    </div>
  );
}
