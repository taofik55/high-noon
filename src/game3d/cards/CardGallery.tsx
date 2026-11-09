"use client";

import { useEffect, useState } from "react";
import { ALL_CARDS, cardType, type CardId } from "@/engine";
import { cardArt } from "./cardArt";
import { cardBackTexture, cardFaceTexture } from "./cardTexture";

/** /dev/cards: one card of every type plus the back, as they are textured on the 3D cards. Developer tool. */
export function CardGallery() {
  const [faces, setFaces] = useState<{ key: string; src: string }[]>([]);

  useEffect(() => {
    let alive = true;
    // One card per type, drawn one per frame so the page stays responsive while the art renders.
    const seen = new Set<string>();
    const ids: CardId[] = [];
    for (const c of ALL_CARDS) {
      if (seen.has(c.type)) continue;
      seen.add(c.type);
      ids.push(c.id);
    }
    const queue: (CardId | "back")[] = [...ids, "back"];
    const step = () => {
      const next = queue.shift();
      if (!next || !alive) return;
      // Make the art first, so the face is drawn complete rather than streamed in.
      if (next !== "back") cardArt(cardType(next));
      const tex = next === "back" ? cardBackTexture() : cardFaceTexture(next);
      const canvas = tex.image as HTMLCanvasElement;
      setFaces((f) => [...f, { key: next, src: canvas.toDataURL() }]);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-stone-900 p-4">
      <h1 className="mb-3 text-lg font-bold tracking-widest text-amber-400 uppercase">Kartu</h1>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3" data-testid="card-gallery">
        {faces.map((f) => (
          // eslint-disable-next-line @next/next/no-img-element -- generated canvas data, not a static asset
          <img key={f.key} src={f.src} alt={f.key} className="w-full rounded-lg shadow-lg" data-testid={`card-${f.key}`} />
        ))}
      </div>
    </div>
  );
}
