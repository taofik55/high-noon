"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import { effectiveDistance, weaponRange, type Action, type CardId, type PlayerView, type Target } from "@/engine";
import { cardName } from "../cards";
import { t } from "../i18n";
import { canAct, type GameStoreState } from "../store/gameStore";
import { Button } from "./Button";
import { CardChip } from "./CardChip";
import { choiceLabel, deriveInteraction, promptText, targetLabel, type Interaction, type PlayOption } from "./interaction";
import { SeatPanel } from "./SeatPanel";

type Mode =
  | { kind: "idle" }
  | { kind: "card"; cardId: CardId; option: PlayOption | null; seat: number | null }
  | { kind: "pick"; purpose: "respond" | "discard" | "ability"; picked: CardId[] };

const IDLE: Mode = { kind: "idle" };

interface GameScreenProps {
  store: StoreApi<GameStoreState>;
  autoplay: boolean;
  onAutoplay: (on: boolean) => void;
  onNewGame: () => void;
}

function pickTarget(purpose: "respond" | "discard" | "ability", i: Interaction): { cardIds: CardId[]; count: number } | null {
  if (purpose === "respond") return i.respond;
  if (purpose === "discard") return i.discard;
  return i.ability;
}

export function GameScreen({ store, autoplay, onAutoplay, onNewGame }: GameScreenProps) {
  const view = useStore(store, (s) => s.presentedView);
  const version = useStore(store, (s) => s.presentedVersion);
  const thinking = useStore(store, (s) => s.thinking);
  const log = useStore(store, (s) => s.log);
  const error = useStore(store, (s) => s.error);
  const speed = useStore(store, (s) => s.speed);
  const actNow = useStore(store, canAct);
  const send = useStore(store, (s) => s.send);
  const setSpeed = useStore(store, (s) => s.setSpeed);

  // Interaction state belongs to one presented version; a newer view silently resets it (no effect needed).
  const [ui, setUi] = useState<{ version: number; mode: Mode }>({ version: 0, mode: IDLE });
  const mode = ui.version === version ? ui.mode : IDLE;
  const setMode = (m: Mode) => setUi({ version, mode: m });

  const logEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: "end" });
  }, [log.length]);

  if (!view) return null;
  const me = view.viewer === "spectator" ? 0 : view.viewer;
  const interaction = deriveInteraction(actNow ? view.legalActions : []);
  const act = (action: Action) => {
    setMode(IDLE);
    void send(action);
  };

  const playWithTarget = (option: PlayOption, target: Target) =>
    act({ type: "PLAY_CARD", cardId: option.cardId, ...(option.asType ? { asType: option.asType } : {}), target });

  const onHandCard = (cardId: CardId) => {
    if (mode.kind === "pick") {
      const spec = pickTarget(mode.purpose, interaction);
      if (!spec?.cardIds.includes(cardId)) return;
      const picked = mode.picked.includes(cardId) ? mode.picked.filter((c) => c !== cardId) : [...mode.picked, cardId].slice(-spec.count);
      setMode({ ...mode, picked });
      return;
    }
    for (const purpose of ["respond", "discard"] as const) {
      const spec = pickTarget(purpose, interaction);
      if (spec?.cardIds.includes(cardId)) {
        if (spec.count === 1) act(purpose === "respond" ? { type: "RESPOND", cardIds: [cardId] } : { type: "DISCARD", cardIds: [cardId] });
        else setMode({ kind: "pick", purpose, picked: [cardId] });
        return;
      }
    }
    const options = interaction.playOptions.get(cardId);
    if (!options || options.length === 0) return;
    const only = options.length === 1 ? options[0] : undefined;
    if (only && only.targets === null) {
      act({ type: "PLAY_CARD", cardId, ...(only.asType ? { asType: only.asType } : {}) });
      return;
    }
    setMode({ kind: "card", cardId, option: only ?? null, seat: null });
  };

  const selectedOption = mode.kind === "card" ? mode.option : null;
  const targetSeats = new Set((selectedOption?.targets ?? []).map((tg) => tg.seat));
  const onSeat = (seat: number) => {
    if (!selectedOption?.targets) return;
    const matching = selectedOption.targets.filter((tg) => tg.seat === seat);
    if (matching.length === 1 && matching[0]) playWithTarget(selectedOption, matching[0]);
    else if (mode.kind === "card") setMode({ ...mode, seat });
  };

  const handState = (cardId: CardId): "normal" | "playable" | "dimmed" | "selected" => {
    if ((mode.kind === "card" && mode.cardId === cardId) || (mode.kind === "pick" && mode.picked.includes(cardId))) return "selected";
    if (!actNow) return "normal";
    if (mode.kind === "pick") return pickTarget(mode.purpose, interaction)?.cardIds.includes(cardId) ? "playable" : "dimmed";
    const usable =
      interaction.playOptions.has(cardId) || interaction.respond?.cardIds.includes(cardId) || interaction.discard?.cardIds.includes(cardId);
    return usable ? "playable" : "dimmed";
  };

  const myPlayer = view.players[me];
  const range = myPlayer ? weaponRange(myPlayer) : 1;
  const n = view.players.length;
  const actor = view.currentActor;
  const actorName = actor === null ? "" : (view.players[actor]?.name ?? "");

  return (
    <div data-testid="game-table" className="flex min-h-screen flex-col gap-4 bg-stone-950 p-4 text-amber-50 lg:flex-row">
      <div className="flex flex-1 flex-col gap-3">
        <header className="flex flex-wrap items-center gap-3 text-sm">
          <h1 className="text-lg font-bold tracking-widest text-amber-400 uppercase">{t("table.title")}</h1>
          <span>{t("table.turn", { n: view.turn.number })}</span>
          <span className="text-amber-300">{t(`phase.${view.turn.phase}`)}</span>
          <div className="ml-auto flex items-center gap-3">
            <label className="flex items-center gap-1">
              <input type="checkbox" data-testid="toggle-fast" checked={speed === "fast"} onChange={(e) => setSpeed(e.target.checked ? "fast" : "normal")} />
              {t("table.fast")}
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" data-testid="toggle-autoplay" checked={autoplay} onChange={(e) => onAutoplay(e.target.checked)} />
              {t("table.autoplay")}
            </label>
            <Button onClick={onNewGame} testId="btn-new-game">
              {t("table.newGame")}
            </Button>
          </div>
        </header>

        <div className="relative h-[34rem] rounded-2xl border border-amber-900/50 bg-gradient-to-b from-amber-950 to-stone-900">
          {view.players.map((p) => {
            const r = (p.seat - me + n) % n;
            const angle = ((90 + (r * 360) / n) * Math.PI) / 180;
            const distance = p.seat === me ? null : effectiveDistance(view, me, p.seat);
            return (
              <div
                key={p.seat}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${50 + 40 * Math.cos(angle)}%`, top: `${50 + 38 * Math.sin(angle)}%` }}
              >
                <SeatPanel
                  player={p}
                  isMe={p.seat === me}
                  isTurn={view.turn.seat === p.seat}
                  isActing={actor === p.seat}
                  thinking={thinking === p.seat}
                  distance={distance}
                  inRange={distance !== null && distance <= range}
                  targetable={targetSeats.has(p.seat)}
                  onTarget={() => onSeat(p.seat)}
                />
              </div>
            );
          })}
          <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-xs text-stone-300">
            <span>{t("table.deck", { n: view.deckCount })}</span>
            <span>{t("table.discard", { n: view.discard.length })}</span>
            {view.discard.at(-1) && <CardChip cardId={view.discard.at(-1) as CardId} size="md" />}
          </div>
        </div>

        <PromptPanel
          view={view}
          actNow={actNow}
          actorName={actorName}
          thinking={thinking !== null}
          error={error}
          mode={mode}
          interaction={interaction}
          onMode={setMode}
          onAct={act}
          onTarget={playWithTarget}
        />

        <section>
          <h2 className="mb-1 text-sm text-amber-300">{t("table.yourHand")}</h2>
          <div className="flex flex-wrap gap-2" data-testid="hand">
            {view.myHand.length === 0 && <span className="text-stone-500">{t("table.empty")}</span>}
            {view.myHand.map((id) => (
              <CardChip key={id} cardId={id} size="md" state={handState(id)} onClick={actNow ? () => onHandCard(id) : undefined} testId="hand-card" />
            ))}
          </div>
        </section>
      </div>

      <aside className="flex max-h-screen w-full flex-col lg:w-96">
        <h2 className="mb-1 text-sm text-amber-300">{t("table.log")}</h2>
        <div className="flex-1 overflow-y-auto rounded border border-stone-700 bg-stone-900 p-2 text-xs leading-relaxed" data-testid="game-log">
          {log.map((entry) => (
            <div
              key={entry.id}
              className={
                {
                  turn: "mt-2 font-bold text-amber-300",
                  attack: "text-orange-300",
                  damage: "text-red-400",
                  heal: "text-emerald-400",
                  death: "font-bold text-red-500",
                  info: "text-stone-300",
                  end: "mt-2 font-bold text-amber-400",
                }[entry.tone]
              }
            >
              {entry.text}
            </div>
          ))}
          <div ref={logEnd} />
        </div>
      </aside>

      {view.winner && <GameOver view={view} onNewGame={onNewGame} />}
    </div>
  );
}

interface PromptPanelProps {
  view: PlayerView;
  actNow: boolean;
  actorName: string;
  thinking: boolean;
  error: string | null;
  mode: Mode;
  interaction: Interaction;
  onMode: (m: Mode) => void;
  onAct: (a: Action) => void;
  onTarget: (option: PlayOption, target: Target) => void;
}

function PromptPanel({ view, actNow, actorName, thinking, error, mode, interaction, onMode, onAct, onTarget }: PromptPanelProps) {
  const promptKind = view.prompt?.kind;
  const passLabel =
    promptKind === "RESPOND_BANG" || promptKind === "RESPOND_INDIANS"
      ? t("action.takeHit")
      : promptKind === "DUEL" || promptKind === "DYING"
        ? t("action.giveUp")
        : t("action.pass");

  if (view.winner) return null;
  if (!actNow) {
    return (
      <div data-testid="prompt-panel" className="rounded border border-stone-700 bg-stone-900 p-3 text-sm text-stone-300">
        {actorName ? (thinking ? t("table.thinking", { name: actorName }) : t("table.waiting", { name: actorName })) : "…"}
      </div>
    );
  }

  const options = mode.kind === "card" ? (interaction.playOptions.get(mode.cardId) ?? []) : [];
  const targets = mode.kind === "card" && mode.option?.targets ? mode.option.targets.filter((tg) => mode.seat === null || tg.seat === mode.seat) : [];
  const pickSpec =
    mode.kind === "pick"
      ? mode.purpose === "respond"
        ? interaction.respond
        : mode.purpose === "discard"
          ? interaction.discard
          : interaction.ability
      : null;

  return (
    <div data-testid="prompt-panel" className="flex flex-col gap-2 rounded border border-amber-600 bg-stone-900 p-3 text-sm">
      <p className="font-semibold text-amber-200">{promptText(view)}</p>
      {error && <p className="text-red-400">{error}</p>}

      {mode.kind === "card" && mode.option === null && (
        <div className="flex flex-wrap gap-2">
          {options.map((o, i) => (
            <Button key={i} tone="primary" onClick={() => (o.targets === null ? onAct({ type: "PLAY_CARD", cardId: o.cardId, ...(o.asType ? { asType: o.asType } : {}) }) : onMode({ ...mode, option: o }))}>
              {o.asType ? t("action.playAsBang") : cardName(o.cardId)}
            </Button>
          ))}
          <Button onClick={() => onMode(IDLE)}>{t("action.cancel")}</Button>
        </div>
      )}

      {mode.kind === "card" && mode.option && (
        <div className="flex flex-col gap-2">
          <span>{t("prompt.chooseTarget", { card: cardName(mode.cardId) })}</span>
          <div className="flex flex-wrap gap-2">
            {targets.map((tg, i) => (
              <Button key={i} tone="primary" testId="target-option" onClick={() => mode.option && onTarget(mode.option, tg)}>
                {targetLabel(view, tg)}
              </Button>
            ))}
            <Button onClick={() => onMode(IDLE)}>{t("action.cancel")}</Button>
          </div>
        </div>
      )}

      {mode.kind === "pick" && pickSpec && (
        <div className="flex flex-wrap gap-2">
          <Button
            tone="primary"
            testId="btn-confirm"
            disabled={mode.picked.length !== pickSpec.count}
            onClick={() =>
              onAct(
                mode.purpose === "respond"
                  ? { type: "RESPOND", cardIds: mode.picked }
                  : mode.purpose === "discard"
                    ? { type: "DISCARD", cardIds: mode.picked }
                    : { type: "ABILITY", ability: "sid_ketchum", cardIds: mode.picked },
              )
            }
          >
            {t("action.confirm", { picked: mode.picked.length, count: pickSpec.count })}
          </Button>
          <Button onClick={() => onMode(IDLE)}>{t("action.cancel")}</Button>
        </div>
      )}

      {mode.kind === "idle" && (
        <div className="flex flex-wrap gap-2">
          {interaction.choices.map((c, i) => {
            const { label, hint } = choiceLabel(view, c);
            return (
              <Button key={i} tone="primary" title={hint} testId="choice-option" onClick={() => onAct({ type: "CHOOSE", choice: c })}>
                {label}
              </Button>
            );
          })}
          {interaction.ability && (
            <Button onClick={() => onMode({ kind: "pick", purpose: "ability", picked: [] })}>{t("action.useSid")}</Button>
          )}
          {interaction.canPass && (
            <Button tone="danger" testId="btn-pass" onClick={() => onAct({ type: "PASS" })}>
              {passLabel}
            </Button>
          )}
          {interaction.canEndTurn && (
            <Button tone="primary" testId="btn-end-turn" onClick={() => onAct({ type: "END_TURN" })}>
              {t("action.endTurn")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function GameOver({ view, onNewGame }: { view: PlayerView; onNewGame: () => void }) {
  if (!view.winner) return null;
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/70" data-testid="game-over">
      <div className="w-full max-w-lg rounded-xl border border-amber-500 bg-stone-900 p-6 text-amber-50 shadow-2xl">
        <h2 className="text-2xl font-bold text-amber-400">{t("gameOver.title")}</h2>
        <p className="mt-1 text-lg" data-testid="winner">
          {t(`winner.${view.winner}`)}
        </p>
        <ul className="mt-4 space-y-1 text-sm">
          {view.players.map((p) => {
            const st = view.stats[p.seat];
            return (
              <li key={p.seat} className="flex justify-between gap-2">
                <span className={p.alive ? "" : "text-stone-500 line-through"}>
                  {p.name} — {p.role ? t(`role.${p.role}`) : "?"}
                </span>
                {st && <span className="text-stone-400">{t("gameOver.stats", { kills: st.kills, damage: st.damageDealt, cards: st.cardsPlayed })}</span>}
              </li>
            );
          })}
        </ul>
        <div className="mt-6">
          <Button tone="primary" onClick={onNewGame} testId="btn-play-again">
            {t("action.playAgain")}
          </Button>
        </div>
      </div>
    </div>
  );
}
