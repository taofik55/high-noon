"use client";

import type { ReactNode } from "react";
import type { SettingsPatch } from "@/lib/rooms/api";
import { NPC_DIFFICULTIES, TURN_TIMERS, type NpcDifficultyName, type RoomSettings } from "@/lib/rooms/rules";
import { t } from "../i18n";

interface LobbySettingsProps {
  settings: RoomSettings;
  editable: boolean;
  busy: boolean;
  onChange: (patch: SettingsPatch) => void;
}

const AFK_OPTIONS = [1, 2, 3, 4, 5] as const;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-stone-300">{label}</span>
      {children}
    </label>
  );
}

/** Room settings (docs/01 §6, docs/04 §5): the host edits, everyone else sees the current values. */
export function LobbySettings({ settings, editable, busy, onChange }: LobbySettingsProps) {
  const selectClass = "rounded border border-stone-600 bg-stone-800 px-1 py-0.5 text-sm disabled:opacity-70";
  const disabled = !editable || busy;
  return (
    <section className="space-y-2 rounded border border-stone-700 bg-stone-900/70 p-3">
      <h2 className="text-sm font-bold text-amber-300">{t("lobby.settings")}</h2>
      <Row label={t("lobby.timer")}>
        <select
          data-testid="setting-timer"
          className={selectClass}
          disabled={disabled}
          value={settings.turnTimerSec}
          onChange={(e) => onChange({ turnTimerSec: Number(e.target.value) as RoomSettings["turnTimerSec"] })}
        >
          {TURN_TIMERS.map((s) => (
            <option key={s} value={s}>
              {s === 0 ? t("lobby.timerOff") : t("lobby.timerSec", { n: s })}
            </option>
          ))}
        </select>
      </Row>
      <Row label={t("setup.characterMode")}>
        <select
          data-testid="setting-character"
          className={selectClass}
          disabled={disabled}
          value={settings.characterMode}
          onChange={(e) => onChange({ characterMode: e.target.value as RoomSettings["characterMode"] })}
        >
          <option value="random">{t("setup.characterMode.random")}</option>
          <option value="choose_of_2">{t("setup.characterMode.choose_of_2")}</option>
        </select>
      </Row>
      <Row label={t("lobby.afk")}>
        <select
          data-testid="setting-afk"
          className={selectClass}
          disabled={disabled}
          value={settings.afkTakeoverAfter}
          onChange={(e) => onChange({ afkTakeoverAfter: Number(e.target.value) })}
        >
          {AFK_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {t("lobby.afkTimeouts", { n })}
            </option>
          ))}
        </select>
      </Row>
      <Row label={t("lobby.botDifficulty")}>
        <select
          data-testid="setting-difficulty"
          className={selectClass}
          disabled={disabled}
          value={settings.defaultNpcDifficulty}
          onChange={(e) => onChange({ defaultNpcDifficulty: e.target.value as NpcDifficultyName })}
        >
          {NPC_DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {t(`difficulty.${d}`)}
            </option>
          ))}
        </select>
      </Row>
    </section>
  );
}
