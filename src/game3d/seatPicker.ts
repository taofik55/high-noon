"use client";

// Drop detection for drag-and-drop. R3F's pointer-over does not always fire for the main scene while a card is being
// dragged from the HUD scene, so a drop also looks for the seat whose projected character is nearest to the pointer.

type Picker = (x: number, y: number) => number | null;

let picker: Picker | null = null;

export function registerSeatPicker(fn: Picker): () => void {
  picker = fn;
  return () => {
    if (picker === fn) picker = null;
  };
}

/** Seat under canvas-relative pixel (x, y), or null. */
export function seatAtPointer(x: number, y: number): number | null {
  return picker?.(x, y) ?? null;
}
