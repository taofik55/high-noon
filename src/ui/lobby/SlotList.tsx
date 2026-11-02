"use client";

import { MAX_SLOTS, NPC_DIFFICULTIES, type LobbySlot, type NpcDifficultyName } from "@/lib/rooms/rules";
import type { SeatOp } from "@/lib/rooms/api";
import { t } from "../i18n";
import { Button } from "../table/Button";

interface SlotListProps {
  slots: readonly LobbySlot[];
  hostId: string;
  meId: string;
  online: ReadonlySet<string>;
  busy: boolean;
  onSeat: (op: SeatOp) => void;
}

/** Seven seats (docs/01 §5.2) with presence dots; host controls appear only for the host. */
export function SlotList({ slots, hostId, meId, online, busy, onSeat }: SlotListProps) {
  const amHost = meId === hostId;
  return (
    <ol className="space-y-1.5">
      {Array.from({ length: MAX_SLOTS }, (_, i) => {
        const s = slots.find((x) => x.slot === i);
        return (
          <li key={i} data-testid={`slot-${i}`} className="flex min-h-11 items-center gap-2 rounded border border-stone-700 bg-stone-900/70 px-3 py-1.5">
            <span className="w-4 text-xs text-stone-500">{i + 1}</span>
            {!s ? (
              <>
                <span className="flex-1 text-sm italic text-stone-500">{t("lobby.empty")}</span>
                {amHost && (
                  <Button testId={`add-npc-${i}`} disabled={busy} onClick={() => onSeat({ op: "add_npc", slot: i })}>
                    {t("lobby.addBot")}
                  </Button>
                )}
              </>
            ) : s.isNpc ? (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-sky-500" title={t("lobby.bot")} />
                <span className="flex-1 truncate font-semibold">{s.displayName}</span>
                {amHost ? (
                  <>
                    <select
                      data-testid={`npc-difficulty-${i}`}
                      aria-label={t("setup.difficulty")}
                      className="rounded border border-stone-600 bg-stone-800 px-1 py-0.5 text-sm"
                      value={s.npcDifficulty ?? "medium"}
                      disabled={busy}
                      onChange={(e) => onSeat({ op: "npc_difficulty", slot: i, difficulty: e.target.value as NpcDifficultyName })}
                    >
                      {NPC_DIFFICULTIES.map((d) => (
                        <option key={d} value={d}>
                          {t(`difficulty.${d}`)}
                        </option>
                      ))}
                    </select>
                    <Button testId={`remove-npc-${i}`} tone="danger" disabled={busy} onClick={() => onSeat({ op: "remove_npc", slot: i })}>
                      {t("lobby.removeBot")}
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-stone-400">
                    {t("lobby.bot")} · {t(`difficulty.${s.npcDifficulty ?? "medium"}`)}
                  </span>
                )}
              </>
            ) : (
              <>
                <span
                  data-testid={`presence-${i}`}
                  data-online={s.userId !== null && online.has(s.userId) ? "true" : "false"}
                  className={`h-2.5 w-2.5 rounded-full ${s.userId !== null && online.has(s.userId) ? "bg-emerald-400" : "bg-stone-600"}`}
                  title={s.userId !== null && online.has(s.userId) ? t("lobby.online") : t("lobby.offline")}
                />
                <span className="flex-1 truncate font-semibold">
                  {s.displayName}
                  {s.userId === meId && <span className="ml-1 text-xs font-normal text-stone-400">({t("lobby.you")})</span>}
                </span>
                {s.userId === hostId ? (
                  <span className="rounded bg-amber-700 px-1.5 text-xs font-bold text-amber-50">{t("lobby.host")}</span>
                ) : (
                  <span data-testid={`ready-${i}`} className={`text-xs ${s.isReady ? "text-emerald-400" : "text-stone-400"}`}>
                    {s.isReady ? t("lobby.ready") : t("lobby.notReady")}
                  </span>
                )}
                {amHost && s.userId !== meId && (
                  <Button testId={`kick-${i}`} tone="danger" disabled={busy} onClick={() => onSeat({ op: "kick", slot: i })}>
                    {t("lobby.kick")}
                  </Button>
                )}
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}
