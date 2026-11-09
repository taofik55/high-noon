"use client";

import { effectiveDistance, weaponRange, type PlayerView } from "@/engine";
import { characterName, characterRules } from "@/ui/cards";
import { t } from "@/ui/i18n";
import { useUi3D } from "../uiStore";
import { registerBadge } from "./badgeAnchors";

interface SeatBadgesProps {
  view: PlayerView;
  targets: ReadonlySet<number>;
  thinking: number | null;
}

/**
 * Name plates above every character (docs/01 §9): name, Sheriff star, character, life bullets, hand count, visible
 * role, distance and "in range" for my current weapon. Positioned by BadgeTracker inside the canvas.
 */
export function SeatBadges({ view, targets, thinking }: SeatBadgesProps) {
  const me = view.viewer === "spectator" ? 0 : view.viewer;
  const myPlayer = view.players[me];
  const range = myPlayer ? weaponRange(myPlayer) : 1;
  const setFocusedSeat = useUi3D((s) => s.setFocusedSeat);
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {view.players.map((p) => {
        const distance = p.seat === me ? null : effectiveDistance(view, me, p.seat);
        const acting = view.currentActor === p.seat;
        const targetable = targets.has(p.seat);
        return (
          <div
            key={p.seat}
            ref={(el) => registerBadge(p.seat, el)}
            data-testid={`seat-badge-${p.seat}`}
            // Keyboard access to the player tooltip (character ability, cards in play): Tab through the badges.
            tabIndex={0}
            aria-label={`${p.name}: ${characterName(p.characterId)}. ${characterRules(p.characterId)}`}
            onFocus={() => setFocusedSeat(p.seat)}
            onBlur={() => setFocusedSeat(null)}
            style={{ position: "absolute", left: 0, top: 0, visibility: "hidden" }}
            className={`w-max max-w-40 min-w-28 rounded-md border px-1.5 py-0.5 text-[10px] outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:max-w-64 sm:min-w-44 sm:px-2 sm:py-1 sm:text-xs whitespace-nowrap text-amber-50 shadow-lg ${
              targetable ? "border-emerald-400 bg-emerald-950/85" : acting ? "border-amber-300 bg-stone-900/85" : "border-stone-600 bg-stone-900/75"
            } ${p.alive ? "" : "opacity-60"}`}
          >
            <div className="flex justify-between gap-1 font-bold">
              <span className="truncate">
                {p.role === "sheriff" && "★ "}
                {p.name}
                {p.seat === me && <span className="text-amber-400"> ({t("table.you")})</span>}
              </span>
              {!p.alive && <span className="text-red-400">{t("table.dead")}</span>}
            </div>
            <div className="truncate text-amber-300">
              {characterName(p.characterId)}
            </div>
            <div className="flex justify-between">
              <span className="text-red-400">{"●".repeat(Math.max(0, p.life)) + "○".repeat(Math.max(0, p.maxLife - p.life))}</span>
              <span className="text-stone-300">{t("table.handCount", { n: p.handCount })}</span>
            </div>
            <div className="text-stone-400">
              {p.role ? t(`role.${p.role}`) : t("role.hidden")}
              {distance !== null && p.alive && (
                <>
                  {" · "}
                  {t("table.distance", { n: distance })}
                  {distance <= range && <span className="text-emerald-400"> · {t("table.inRange")}</span>}
                </>
              )}
            </div>
            {thinking === p.seat && <div className="text-amber-300">{t("table.thinking", { name: p.name })}</div>}
          </div>
        );
      })}
    </div>
  );
}
