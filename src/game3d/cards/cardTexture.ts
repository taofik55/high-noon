"use client";

import { CanvasTexture, SRGBColorSpace } from "three";
import type { CardId } from "@/engine";
import { GAME_TITLE } from "@/config/game";
import { cardFace, type CardFace } from "./cardFace";

// Generated card textures (docs/05 §11): readable placeholders until the real card art arrives (Phase 12).

const W = 256;
const H = 358; // 63×88 card ratio
const RADIUS = 18;

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
  texture.anisotropy = 4;
  return texture;
}

function drawFace(ctx: CanvasRenderingContext2D, face: CardFace): void {
  ctx.clearRect(0, 0, W, H);
  roundedRect(ctx, 2, 2, W - 4, H - 4, RADIUS);
  ctx.fillStyle = face.family === "blue" ? "#dfe8f2" : "#f1e2c2";
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = face.family === "blue" ? "#2f5d8a" : "#7a4a22";
  ctx.stroke();

  // Title band
  ctx.fillStyle = face.family === "blue" ? "#2f5d8a" : "#7a4a22";
  ctx.fillRect(14, 56, W - 28, 52);
  ctx.fillStyle = "#fff8ea";
  ctx.font = "bold 30px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(face.title, W / 2, 83, W - 40);

  // Corner (rank + suit), top-left and bottom-right
  ctx.fillStyle = face.red ? "#b3261e" : "#1d1a17";
  ctx.font = "bold 30px Georgia, serif";
  ctx.textAlign = "left";
  ctx.fillText(face.corner, 18, 30);
  ctx.textAlign = "right";
  ctx.fillText(face.corner, W - 18, H - 26);

  // Rules text
  ctx.fillStyle = "#2b241d";
  ctx.font = "19px Georgia, serif";
  ctx.textAlign = "center";
  const lines = wrap(ctx, face.rules, W - 44).slice(0, 7);
  lines.forEach((l, i) => ctx.fillText(l, W / 2, 150 + i * 25));
}

function drawBack(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, W, H);
  roundedRect(ctx, 2, 2, W - 4, H - 4, RADIUS);
  ctx.fillStyle = "#5b1f16";
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#d9a441";
  ctx.stroke();
  roundedRect(ctx, 22, 22, W - 44, H - 44, 12);
  ctx.lineWidth = 3;
  ctx.stroke();
  // Five-pointed star
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 62 : 26;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(W / 2 + r * Math.cos(a), H / 2 - 20 + r * Math.sin(a));
  }
  ctx.closePath();
  ctx.fillStyle = "#d9a441";
  ctx.fill();
  ctx.fillStyle = "#f3d58c";
  ctx.font = "bold 28px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(GAME_TITLE.toUpperCase(), W / 2, H - 70, W - 50);
}

export function cardFaceTexture(id: CardId): CanvasTexture {
  let texture = cache.get(id);
  if (!texture) {
    texture = makeTexture((ctx) => drawFace(ctx, cardFace(id)));
    cache.set(id, texture);
  }
  return texture;
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
