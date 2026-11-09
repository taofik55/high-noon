"use client";

import { CanvasTexture, SRGBColorSpace } from "three";
import type { CardId } from "@/engine";
import { GAME_TITLE } from "@/config/game";
import { cardType, type CardType } from "@/engine";
import { ALL_CARDS } from "@/engine";
import { enqueue, PRIORITY } from "../streaming/buildQueue";
import { ART_H, ART_W, cardArt, peekCardArt } from "./cardArt";
import { cardFace, type CardFace } from "./cardFace";

// Card faces (docs/07 §2.5): corner index, title band, an engraved illustration of the card's scene (cardArt.ts),
// then the rules; all drawn on a canvas, text by code so the art stays text-free.

const W = 512;
const H = 716; // 63×88 card ratio
const RADIUS = 36;

const cache = new Map<string, CanvasTexture>();

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function makeTexture(draw: (ctx: CanvasRenderingContext2D) => void): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function drawFace(ctx: CanvasRenderingContext2D, face: CardFace, art: HTMLCanvasElement | null): void {
  ctx.clearRect(0, 0, W, H);
  const ink = face.family === "blue" ? "#2f5d8a" : "#7a4a22";
  roundedRect(ctx, 4, 4, W - 8, H - 8, RADIUS);
  ctx.fillStyle = face.family === "blue" ? "#e2eaf2" : "#f1e2c2";
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = ink;
  ctx.stroke();

  // Corner (rank + suit), top-left and bottom-right
  ctx.fillStyle = face.red ? "#b3261e" : "#1d1a17";
  ctx.font = "bold 52px Georgia, serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(face.corner, 34, 56);
  ctx.textAlign = "right";
  ctx.fillText(face.corner, W - 34, H - 48);

  // Title band
  ctx.fillStyle = ink;
  ctx.fillRect(26, 96, W - 52, 92);
  ctx.fillStyle = "#fff8ea";
  ctx.font = "bold 56px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText(face.title, W / 2, 144, W - 80);

  // Illustration panel with a thin frame (a plain panel if no art could be made).
  const ax = (W - ART_W) / 2;
  const ay = 206;
  if (art) ctx.drawImage(art, ax, ay, ART_W, ART_H);
  else {
    ctx.fillStyle = face.family === "blue" ? "#cdd9e6" : "#e4cfa6";
    ctx.fillRect(ax, ay, ART_W, ART_H);
  }
  ctx.lineWidth = 4;
  ctx.strokeStyle = ink;
  ctx.strokeRect(ax, ay, ART_W, ART_H);

  // Rules text
  ctx.fillStyle = "#2b241d";
  ctx.font = "30px Georgia, serif";
  ctx.textAlign = "center";
  const lines = wrap(ctx, face.rules, W - 80).slice(0, 5);
  lines.forEach((l, i) => ctx.fillText(l, W / 2, ay + ART_H + 44 + i * 36));
}

function drawBack(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, W, H);
  roundedRect(ctx, 4, 4, W - 8, H - 8, RADIUS);
  ctx.fillStyle = "#5b1f16";
  ctx.fill();
  ctx.lineWidth = 16;
  ctx.strokeStyle = "#d9a441";
  ctx.stroke();
  roundedRect(ctx, 44, 44, W - 88, H - 88, 24);
  ctx.lineWidth = 6;
  ctx.stroke();
  // Tooled-leather pattern: a lattice of thin diagonal lines inside the inner border.
  ctx.save();
  roundedRect(ctx, 50, 50, W - 100, H - 100, 20);
  ctx.clip();
  ctx.strokeStyle = "rgba(217,164,65,0.18)";
  ctx.lineWidth = 2;
  for (let i = -H; i < W + H; i += 28) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + H, H);
    ctx.moveTo(i, H);
    ctx.lineTo(i + H, 0);
    ctx.stroke();
  }
  ctx.restore();
  // Sheriff's star in a ring.
  ctx.beginPath();
  ctx.arc(W / 2, H / 2 - 40, 150, 0, Math.PI * 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#d9a441";
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 124 : 52;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(W / 2 + r * Math.cos(a), H / 2 - 40 + r * Math.sin(a));
  }
  ctx.closePath();
  ctx.fillStyle = "#d9a441";
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    ctx.beginPath();
    ctx.arc(W / 2 + 124 * Math.cos(a), H / 2 - 40 + 124 * Math.sin(a), 12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#f3d58c";
  ctx.font = "bold 56px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(GAME_TITLE.toUpperCase(), W / 2, H - 120, W - 100);
}

/**
 * The face texture of a card. Illustrations are expensive (an offscreen 3D render each), so a face whose art is not
 * made yet is drawn with a plain panel first and redrawn once the build queue has made the art.
 */
export function cardFaceTexture(id: CardId, priority: number = PRIORITY.visible): CanvasTexture {
  let texture = cache.get(id);
  if (!texture) {
    const type = cardType(id);
    const art = peekCardArt(type);
    const t = makeTexture((ctx) => drawFace(ctx, cardFace(id), art ?? null));
    if (art === undefined) {
      void enqueue(`art:${type}`, "cards", priority, () => cardArt(type)).then((made) => {
        const ctx = (t.image as HTMLCanvasElement).getContext("2d");
        if (!made || !ctx) return;
        drawFace(ctx, cardFace(id), made);
        t.needsUpdate = true;
      });
    }
    texture = t;
    cache.set(id, texture);
  }
  return texture;
}

/** Queues every card type's illustration behind the game (background streaming). */
export function prefetchCardArt(): void {
  const seen = new Set<CardType>();
  for (const c of ALL_CARDS) {
    if (seen.has(c.type) || peekCardArt(c.type) !== undefined) continue;
    seen.add(c.type);
    void enqueue(`art:${c.type}`, "cards", PRIORITY.prefetch, () => cardArt(c.type));
  }
}

export function cardBackTexture(): CanvasTexture {
  let texture = cache.get("back");
  if (!texture) {
    texture = makeTexture(drawBack);
    cache.set("back", texture);
  }
  return texture;
}

export const CARD_TEXTURE_SIZE = { width: W, height: H } as const;
