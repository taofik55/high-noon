import { CanvasTexture, Color, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, type Texture } from "three";

/**
 * Shared materials for every procedural asset. Colour comes from vertex colours, so one material per surface type
 * (cloth, skin, leather, metal, wood…) serves every character and building: few materials, few draw calls. The
 * canvas textures only add a faint grain; the shapes carry the detail.
 */
export type MaterialKey =
  | "cloth"
  | "skin"
  | "leather"
  | "steel"
  | "brass"
  | "wood"
  | "paint"
  | "eye"
  | "hair"
  | "glass"
  | "lamp"
  | "sign";

type Grain = "weave" | "wood" | "paint" | "leather" | "brushed" | "none";

const SPEC: Record<MaterialKey, { roughness: number; metalness: number; grain: Grain; repeat?: number; emissive?: string; opacity?: number }> = {
  cloth: { roughness: 0.92, metalness: 0, grain: "weave", repeat: 6 },
  skin: { roughness: 0.62, metalness: 0, grain: "none" },
  leather: { roughness: 0.55, metalness: 0, grain: "leather", repeat: 4 },
  steel: { roughness: 0.34, metalness: 0.8, grain: "brushed", repeat: 8 },
  brass: { roughness: 0.3, metalness: 0.9, grain: "none" },
  wood: { roughness: 0.82, metalness: 0, grain: "wood", repeat: 1.2 },
  paint: { roughness: 0.72, metalness: 0, grain: "paint", repeat: 1.2 },
  eye: { roughness: 0.15, metalness: 0, grain: "none" },
  hair: { roughness: 0.75, metalness: 0, grain: "none" },
  glass: { roughness: 0.08, metalness: 0.1, grain: "none", opacity: 0.75 },
  lamp: { roughness: 0.4, metalness: 0, grain: "none", emissive: "#ffb347" },
  sign: { roughness: 0.75, metalness: 0, grain: "none" },
};

const cache = new Map<string, MeshStandardMaterial>();
const textures = new Map<Grain, Texture | null>();

/** Seeded value noise, so textures are identical on every load. */
function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function grainTexture(kind: Grain): Texture | null {
  if (kind === "none" || typeof document === "undefined") return null;
  if (textures.has(kind)) return textures.get(kind) ?? null;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const r = rand(kind.length * 977);
  const rows = Array.from({ length: size }, () => r());
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 1;
      // Straight grain: each 2-pixel row gets its own shade, with a little speckle.
      const row = rows[y >> 1] ?? 0;
      if (kind === "weave") v = 0.9 + 0.06 * (((x >> 1) + (y >> 1)) % 2) + 0.04 * r();
      else if (kind === "wood") v = 0.86 + 0.1 * row + 0.04 * r();
      else if (kind === "paint") v = 0.95 + 0.035 * row + 0.015 * r();
      else if (kind === "leather") v = 0.88 + 0.12 * r() * r();
      else if (kind === "brushed") v = 0.9 + 0.1 * Math.sin(y * 1.7 + r());
      const c = Math.round(255 * Math.min(1, Math.max(0, v)));
      const i = (y * size + x) * 4;
      img.data[i] = c;
      img.data[i + 1] = c;
      img.data[i + 2] = c;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  textures.set(kind, tex);
  return tex;
}

/** The shared material for a surface type (vertex-coloured). */
export function material(key: MaterialKey): MeshStandardMaterial {
  const hit = cache.get(key);
  if (hit) return hit;
  const spec = SPEC[key];
  const m = new MeshStandardMaterial({
    vertexColors: true,
    roughness: spec.roughness,
    metalness: spec.metalness,
    transparent: spec.opacity !== undefined,
    opacity: spec.opacity ?? 1,
  });
  const map = grainTexture(spec.grain);
  if (map) {
    const t = map.clone();
    t.repeat.set(spec.repeat ?? 1, spec.repeat ?? 1);
    t.needsUpdate = true;
    m.map = t;
  }
  if (spec.emissive) {
    m.emissive = new Color(spec.emissive);
    m.emissiveIntensity = 1.6;
  }
  m.name = `procedural.${key}`;
  cache.set(key, m);
  return m;
}

export function isMaterialKey(key: string): key is MaterialKey {
  return key in SPEC;
}
