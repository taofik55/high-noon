"use client";

import type { CardId } from "@/engine";
import { cardLabel, cardRules, isRedSuit } from "../cards";

interface CardChipProps {
  cardId: CardId;
  size?: "sm" | "md";
  state?: "normal" | "playable" | "dimmed" | "selected";
  onClick?: () => void;
  testId?: string;
}

/** A card as a small labelled tile; the native tooltip carries the rules text (docs/01 §9). */
export function CardChip({ cardId, size = "sm", state = "normal", onClick, testId }: CardChipProps) {
  const base = size === "md" ? "min-w-28 px-3 py-2 text-sm" : "px-2 py-0.5 text-xs";
  const tone = {
    normal: "border-amber-700/60 bg-amber-50 text-stone-900",
    playable: "border-emerald-500 bg-amber-50 text-stone-900 ring-2 ring-emerald-400 hover:-translate-y-1",
    dimmed: "border-stone-600 bg-stone-300 text-stone-600 opacity-60",
    selected: "border-sky-500 bg-sky-100 text-stone-900 ring-2 ring-sky-400 -translate-y-1",
  }[state];
  const suit = isRedSuit(cardId) ? "text-red-700" : "text-stone-900";
  return (
    <button
      type="button"
      title={cardRules(cardId)}
      onClick={onClick}
      disabled={!onClick}
      data-testid={testId}
      data-card={cardId}
      className={`rounded border font-semibold shadow-sm transition ${base} ${tone} ${suit} disabled:cursor-default`}
    >
      {cardLabel(cardId)}
    </button>
  );
}
