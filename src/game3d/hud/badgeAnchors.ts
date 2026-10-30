"use client";

// Screen-space name plates (docs/05 §2 "screen-space HUD badge"): plain DOM elements over the canvas, moved every
// frame by BadgeTracker through these refs. No React re-render per frame and no extra React roots.

const anchors = new Map<number, HTMLElement>();

export function registerBadge(seat: number, el: HTMLElement | null): void {
  if (el) anchors.set(seat, el);
  else anchors.delete(seat);
}

export function badgeElement(seat: number): HTMLElement | undefined {
  return anchors.get(seat);
}
