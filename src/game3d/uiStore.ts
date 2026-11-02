"use client";

import { create } from "zustand";
import type { CardId } from "@/engine";

export interface Banner {
  text: string;
  tone: "info" | "danger" | "gold";
}

/** Pointer and staging state of the 3D table (presentation only; game state lives in gameStore). */
interface Ui3DState {
  hoveredSeat: number | null;
  hoveredCard: CardId | null;
  /** A hand card being dragged, with the pointer position in canvas pixels. */
  drag: { cardId: CardId; x: number; y: number; active: boolean } | null;
  freeCamera: boolean;
  /** The Director owns the camera (CINEMATIC mode, docs/05 §3). */
  cinematic: boolean;
  banner: Banner | null;
  setHoveredSeat(seat: number | null): void;
  setHoveredCard(card: CardId | null): void;
  setDrag(drag: Ui3DState["drag"]): void;
  setFreeCamera(on: boolean): void;
  setCinematic(on: boolean): void;
  setBanner(banner: Banner | null): void;
}

export const useUi3D = create<Ui3DState>()((set) => ({
  hoveredSeat: null,
  hoveredCard: null,
  drag: null,
  freeCamera: false,
  cinematic: false,
  banner: null,
  setHoveredSeat: (hoveredSeat) => set({ hoveredSeat }),
  setHoveredCard: (hoveredCard) => set({ hoveredCard }),
  setDrag: (drag) => set({ drag }),
  setFreeCamera: (freeCamera) => set({ freeCamera }),
  setCinematic: (cinematic) => set({ cinematic }),
  setBanner: (banner) => set({ banner }),
}));
