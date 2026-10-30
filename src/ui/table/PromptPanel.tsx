"use client";

import { cardName } from "../cards";
import { t } from "../i18n";
import { Button } from "./Button";
import { choiceLabel, promptText, targetLabel } from "./interaction";
import { IDLE, pickSpec, type TableInteraction } from "./useTableInteraction";

interface PromptPanelProps {
  ti: TableInteraction;
  /** Seat whose move it is (for the "waiting for…" line). */
  thinking: boolean;
  error: string | null;
  className?: string;
}

/**
 * Text and buttons for the current prompt, shared by the 2D and the 3D table. Every button comes from the legal-action
 * descriptors, so the whole game can be played from this panel alone (also the keyboard / screen-reader path).
 */
export function PromptPanel({ ti, thinking, error, className = "" }: PromptPanelProps) {
  const { view, actNow, mode, interaction, setMode, act, playOption } = ti;
  if (!view || view.winner) return null;
  const promptKind = view.prompt?.kind;
  const passLabel =
    promptKind === "RESPOND_BANG" || promptKind === "RESPOND_INDIANS"
      ? t("action.takeHit")
      : promptKind === "DUEL" || promptKind === "DYING"
        ? t("action.giveUp")
        : t("action.pass");

  if (!actNow) {
    const actor = view.currentActor;
    const name = actor === null ? "" : (view.players[actor]?.name ?? "");
    return (
      <div data-testid="prompt-panel" className={`rounded border border-stone-700 bg-stone-900/90 p-3 text-sm text-stone-300 ${className}`}>
        {name ? (thinking ? t("table.thinking", { name }) : t("table.waiting", { name })) : "…"}
      </div>
    );
  }

  const options = mode.kind === "card" ? (interaction.playOptions.get(mode.cardId) ?? []) : [];
  const targets = mode.kind === "card" && mode.option?.targets ? mode.option.targets.filter((tg) => mode.seat === null || tg.seat === mode.seat) : [];
  const spec = mode.kind === "pick" ? pickSpec(mode.purpose, interaction) : null;

  return (
    <div data-testid="prompt-panel" className={`flex flex-col gap-2 rounded border border-amber-600 bg-stone-900/90 p-3 text-sm ${className}`}>
      <p className="font-semibold text-amber-200">{promptText(view)}</p>
      {error && <p className="text-red-400">{error}</p>}

      {mode.kind === "card" && mode.option === null && (
        <div className="flex flex-wrap gap-2">
          {options.map((o, i) => (
            <Button key={i} tone="primary" onClick={() => (o.targets === null ? playOption(o) : setMode({ ...mode, option: o }))}>
              {o.asType ? t("action.playAsBang") : cardName(o.cardId)}
            </Button>
          ))}
          <Button onClick={() => setMode(IDLE)}>{t("action.cancel")}</Button>
        </div>
      )}

      {mode.kind === "card" && mode.option && mode.option.targets === null && (
        <div className="flex flex-wrap gap-2">
          <Button tone="primary" testId="btn-play-card" onClick={() => mode.option && playOption(mode.option)}>
            {t("action.play", { card: cardName(mode.cardId) })}
          </Button>
          <Button onClick={() => setMode(IDLE)}>{t("action.cancel")}</Button>
        </div>
      )}

      {mode.kind === "card" && mode.option && mode.option.targets !== null && (
        <div className="flex flex-col gap-2">
          <span>{t("prompt.chooseTarget", { card: cardName(mode.cardId) })}</span>
          <div className="flex flex-wrap gap-2">
            {targets.map((tg, i) => (
              <Button key={i} tone="primary" testId="target-option" onClick={() => mode.option && playOption(mode.option, tg)}>
                {targetLabel(view, tg)}
              </Button>
            ))}
            <Button onClick={() => setMode(IDLE)}>{t("action.cancel")}</Button>
          </div>
        </div>
      )}

      {mode.kind === "pick" && spec && (
        <div className="flex flex-wrap gap-2">
          <Button
            tone="primary"
            testId="btn-confirm"
            disabled={mode.picked.length !== spec.count}
            onClick={() =>
              act(
                mode.purpose === "respond"
                  ? { type: "RESPOND", cardIds: mode.picked }
                  : mode.purpose === "discard"
                    ? { type: "DISCARD", cardIds: mode.picked }
                    : { type: "ABILITY", ability: "sid_ketchum", cardIds: mode.picked },
              )
            }
          >
            {t("action.confirm", { picked: mode.picked.length, count: spec.count })}
          </Button>
          <Button onClick={() => setMode(IDLE)}>{t("action.cancel")}</Button>
        </div>
      )}

      {mode.kind === "idle" && (
        <div className="flex flex-wrap gap-2">
          {interaction.choices.map((c, i) => {
            const { label, hint } = choiceLabel(view, c);
            return (
              <Button key={i} tone="primary" title={hint} testId="choice-option" onClick={() => act({ type: "CHOOSE", choice: c })}>
                {label}
              </Button>
            );
          })}
          {interaction.ability && <Button onClick={() => setMode({ kind: "pick", purpose: "ability", picked: [] })}>{t("action.useSid")}</Button>}
          {interaction.canPass && (
            <Button tone="danger" testId="btn-pass" onClick={() => act({ type: "PASS" })}>
              {passLabel}
            </Button>
          )}
          {interaction.canEndTurn && (
            <Button tone="primary" testId="btn-end-turn" onClick={() => act({ type: "END_TURN" })}>
              {t("action.endTurn")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
