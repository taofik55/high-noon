"use client";

import { useState } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import type { Action, CardId, PlayerView, Target } from "@/engine";
import { canAct, type GameStoreState } from "../store/gameStore";
import { deriveInteraction, type Interaction, type PlayOption } from "./interaction";

export type PickPurpose = "respond" | "discard" | "ability";

export type Mode =
  | { kind: "idle" }
  /** A hand card is selected. `option` null = several ways to play it; `seat` narrows the target list. */
  | { kind: "card"; cardId: CardId; option: PlayOption | null; seat: number | null }
  | { kind: "pick"; purpose: PickPurpose; picked: CardId[] };

export const IDLE: Mode = { kind: "idle" };

export type HandCardState = "normal" | "playable" | "dimmed" | "selected";

export interface TableInteraction {
  view: PlayerView | null;
  version: number;
  actNow: boolean;
  interaction: Interaction;
  mode: Mode;
  setMode(mode: Mode): void;
  act(action: Action): void;
  playOption(option: PlayOption, target?: Target): void;
  onHandCard(cardId: CardId): void;
  /** A seat was clicked or a card was dropped on it. */
  onSeat(seat: number): void;
  /** Drag-and-drop: play `cardId` on `seat` (or untargeted when `seat` is null). Returns false if not possible. */
  dropCard(cardId: CardId, seat: number | null): boolean;
  handState(cardId: CardId): HandCardState;
  targetSeats: ReadonlySet<number>;
}

export function pickSpec(purpose: PickPurpose, i: Interaction): { cardIds: CardId[]; count: number } | null {
  if (purpose === "respond") return i.respond;
  if (purpose === "discard") return i.discard;
  return i.ability;
}

export interface TableInteractionOptions {
  /**
   * 3D table: a click only selects a card that needs no target (play it with the button, a double-click or a drag),
   * so a stray click never wastes a Beer. The 2D debug table plays it immediately.
   */
  confirmUntargeted?: boolean;
}

/**
 * The selection state machine shared by the 2D and the 3D table. Everything it offers comes from
 * `presentedView.legalActions` (Golden rule 7). The state belongs to one presented version: a newer view resets it.
 */
export function useTableInteraction(store: StoreApi<GameStoreState>, opts: TableInteractionOptions = {}): TableInteraction {
  const view = useStore(store, (s) => s.presentedView);
  const version = useStore(store, (s) => s.presentedVersion);
  const actNow = useStore(store, canAct);
  const send = useStore(store, (s) => s.send);

  const [ui, setUi] = useState<{ version: number; mode: Mode }>({ version: 0, mode: IDLE });
  const mode = ui.version === version ? ui.mode : IDLE;
  const setMode = (m: Mode) => setUi({ version, mode: m });

  const interaction = deriveInteraction(actNow && view ? view.legalActions : []);

  const act = (action: Action) => {
    setMode(IDLE);
    void send(action);
  };

  const playOption = (option: PlayOption, target?: Target) =>
    act({ type: "PLAY_CARD", cardId: option.cardId, ...(option.asType ? { asType: option.asType } : {}), ...(target ? { target } : {}) });

  const onHandCard = (cardId: CardId) => {
    if (mode.kind === "pick") {
      const spec = pickSpec(mode.purpose, interaction);
      if (!spec?.cardIds.includes(cardId)) return;
      const picked = mode.picked.includes(cardId) ? mode.picked.filter((c) => c !== cardId) : [...mode.picked, cardId].slice(-spec.count);
      setMode({ ...mode, picked });
      return;
    }
    for (const purpose of ["respond", "discard"] as const) {
      const spec = pickSpec(purpose, interaction);
      if (spec?.cardIds.includes(cardId)) {
        if (spec.count === 1) act(purpose === "respond" ? { type: "RESPOND", cardIds: [cardId] } : { type: "DISCARD", cardIds: [cardId] });
        else setMode({ kind: "pick", purpose, picked: [cardId] });
        return;
      }
    }
    const options = interaction.playOptions.get(cardId);
    if (!options || options.length === 0) return;
    if (mode.kind === "card" && mode.cardId === cardId) {
      setMode(IDLE); // second click on the selected card deselects it
      return;
    }
    const only = options.length === 1 ? options[0] : undefined;
    if (only && only.targets === null && !opts.confirmUntargeted) {
      playOption(only);
      return;
    }
    setMode({ kind: "card", cardId, option: only ?? null, seat: null });
  };

  const selected = mode.kind === "card" ? mode.option : null;
  const targetSeats = new Set<number>();
  for (const tg of selected?.targets ?? []) if (tg.seat !== undefined) targetSeats.add(tg.seat);

  const onSeat = (seat: number) => {
    if (!selected?.targets) return;
    const matching = selected.targets.filter((tg) => tg.seat === seat);
    if (matching.length === 1 && matching[0]) playOption(selected, matching[0]);
    else if (matching.length > 1 && mode.kind === "card") setMode({ ...mode, seat });
  };

  const dropCard = (cardId: CardId, seat: number | null): boolean => {
    const options = interaction.playOptions.get(cardId) ?? [];
    if (seat === null) {
      const untargeted = options.find((o) => o.targets === null);
      if (!untargeted) return false;
      playOption(untargeted);
      return true;
    }
    for (const option of options) {
      const matching = (option.targets ?? []).filter((tg) => tg.seat === seat);
      if (matching.length === 1 && matching[0]) {
        playOption(option, matching[0]);
        return true;
      }
      if (matching.length > 1) {
        // Panic! / Cat Balou: which card? Let the prompt panel ask.
        setMode({ kind: "card", cardId, option, seat });
        return true;
      }
    }
    return false;
  };

  const handState = (cardId: CardId): HandCardState => {
    if ((mode.kind === "card" && mode.cardId === cardId) || (mode.kind === "pick" && mode.picked.includes(cardId))) return "selected";
    if (!actNow) return "normal";
    if (mode.kind === "pick") return pickSpec(mode.purpose, interaction)?.cardIds.includes(cardId) ? "playable" : "dimmed";
    const usable =
      interaction.playOptions.has(cardId) || interaction.respond?.cardIds.includes(cardId) || interaction.discard?.cardIds.includes(cardId);
    return usable ? "playable" : "dimmed";
  };

  return { view, version, actNow, interaction, mode, setMode, act, playOption, onHandCard, onSeat, dropCard, handState, targetSeats };
}
