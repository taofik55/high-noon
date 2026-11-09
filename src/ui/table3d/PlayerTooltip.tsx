"use client";

import type { PlayerView } from "@/engine";
import { useUi3D } from "@/game3d/uiStore";
import { cardLabel, cardRules, characterName, characterRules } from "../cards";
import { t } from "../i18n";

/**
 * What a player can do, at a glance (docs/01 §9): their character's ability and the blue cards in front of them.
 * Shown while hovering their character in 3D, or while their seat badge has keyboard focus.
 */
export function PlayerTooltip({ view }: { view: PlayerView }) {
  const hovered = useUi3D((s) => s.hoveredSeat);
  const focused = useUi3D((s) => s.focusedSeat);
  const card = useUi3D((s) => s.hoveredCard);
  const seat = focused ?? hovered;
  const p = seat === null ? null : view.players[seat];
  // A hovered card has its own tooltip, unless the player is asking with the keyboard.
  if (!p || (card && focused === null)) return null;
  return (
    <div
      data-testid="player-tooltip"
      role="tooltip"
      className="pointer-events-none absolute bottom-64 left-1/2 z-30 w-80 -translate-x-1/2 space-y-2 rounded border border-amber-600 bg-stone-900/95 p-3 text-sm shadow-xl"
    >
      <div>
        <div className="font-bold text-amber-300">
          {p.name} · {characterName(p.characterId)}
        </div>
        <div className="text-stone-200">{characterRules(p.characterId)}</div>
      </div>
      {p.inPlay.length > 0 && (
        <div className="space-y-1 border-t border-stone-700 pt-2">
          <div className="text-xs tracking-wide text-stone-400 uppercase">{t("tooltip.inPlay")}</div>
          {p.inPlay.map((id) => (
            <div key={id}>
              <span className="font-semibold text-sky-300">{cardLabel(id)}</span>
              <span className="text-stone-300"> — {cardRules(id)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
