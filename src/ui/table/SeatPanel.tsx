"use client";

import type { PublicPlayer } from "@/engine";
import { characterName, characterRules } from "../cards";
import { t } from "../i18n";
import { CardChip } from "./CardChip";

interface SeatPanelProps {
  player: PublicPlayer;
  isMe: boolean;
  isTurn: boolean;
  isActing: boolean;
  thinking: boolean;
  distance: number | null;
  inRange: boolean;
  targetable: boolean;
  onTarget?: () => void;
}

function lifeBullets(life: number, maxLife: number): string {
  return "●".repeat(Math.max(0, life)) + "○".repeat(Math.max(0, maxLife - life));
}

export function SeatPanel({ player, isMe, isTurn, isActing, thinking, distance, inRange, targetable, onTarget }: SeatPanelProps) {
  const border = targetable
    ? "border-emerald-400 ring-2 ring-emerald-400 cursor-pointer hover:bg-stone-800"
    : isActing
      ? "border-amber-300 ring-2 ring-amber-300"
      : isTurn
        ? "border-amber-500"
        : "border-stone-600";
  return (
    <div
      role={targetable ? "button" : undefined}
      tabIndex={targetable ? 0 : undefined}
      onClick={targetable ? onTarget : undefined}
      onKeyDown={targetable ? (e) => (e.key === "Enter" || e.key === " ") && onTarget?.() : undefined}
      data-testid={`seat-${player.seat}`}
      className={`w-48 rounded-lg border bg-stone-900/90 p-2 text-amber-50 shadow-lg transition ${border} ${player.alive ? "" : "opacity-50 grayscale"}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate font-bold">
          {player.role === "sheriff" && <span title={t("role.sheriff")}>★ </span>}
          {player.name}
          {isMe && <span className="text-amber-400"> ({t("table.you")})</span>}
        </span>
        {!player.alive && <span className="text-xs text-red-400">{t("table.dead")}</span>}
      </div>
      <div className="truncate text-xs text-amber-300" title={characterRules(player.characterId)}>
        {characterName(player.characterId)}
      </div>
      <div className="mt-1 flex items-center justify-between text-sm">
        <span className="tracking-tight text-red-400" title={`${player.life}/${player.maxLife}`}>
          {lifeBullets(player.life, player.maxLife)}
        </span>
        <span className="text-xs text-stone-300">{t("table.handCount", { n: player.handCount })}</span>
      </div>
      <div className="mt-1 text-xs text-stone-400">
        {player.role ? t(`role.${player.role}`) : t("role.hidden")}
        {distance !== null && player.alive && (
          <>
            {" · "}
            {t("table.distance", { n: distance })}
            {inRange && <span className="text-emerald-400"> · {t("table.inRange")}</span>}
          </>
        )}
      </div>
      {player.inPlay.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {player.inPlay.map((id) => (
            <CardChip key={id} cardId={id} />
          ))}
        </div>
      )}
      {(isActing || thinking) && (
        <div className="mt-1 text-xs text-amber-300">{thinking ? t("table.thinking", { name: player.name }) : t("table.acting")}</div>
      )}
    </div>
  );
}
