import type { CardId, Choice, LegalAction, PlayerView, Target } from "@/engine";
import { cardLabel, characterName, characterRules } from "../cards";
import { t } from "../i18n";

export type PlayOption = Extract<LegalAction, { type: "PLAY_CARD" }>;
type Respond = Extract<LegalAction, { type: "RESPOND" }>;
type Discard = Extract<LegalAction, { type: "DISCARD" }>;
type Ability = Extract<LegalAction, { type: "ABILITY" }>;

/**
 * Everything the 2D table may offer, derived only from `legalActions` (Golden rule 7): the UI never decides what is
 * legal itself, it just shows these descriptors.
 */
export interface Interaction {
  playOptions: Map<CardId, PlayOption[]>;
  respond: Respond | null;
  discard: Discard | null;
  ability: Ability | null;
  choices: Choice[];
  canPass: boolean;
  canEndTurn: boolean;
}

export function deriveInteraction(legal: readonly LegalAction[]): Interaction {
  const playOptions = new Map<CardId, PlayOption[]>();
  let respond: Respond | null = null;
  let discard: Discard | null = null;
  let ability: Ability | null = null;
  let choices: Choice[] = [];
  for (const l of legal) {
    if (l.type === "PLAY_CARD") playOptions.set(l.cardId, [...(playOptions.get(l.cardId) ?? []), l]);
    else if (l.type === "RESPOND") respond = l;
    else if (l.type === "DISCARD") discard = l;
    else if (l.type === "ABILITY") ability = l;
    else if (l.type === "CHOOSE") choices = l.choices;
  }
  return {
    playOptions,
    respond,
    discard,
    ability,
    choices,
    canPass: legal.some((l) => l.type === "PASS"),
    canEndTurn: legal.some((l) => l.type === "END_TURN"),
  };
}

function nameOf(view: PlayerView, seat: number | undefined): string {
  if (seat === undefined) return "?";
  return seat === view.viewer ? t("table.you") : (view.players[seat]?.name ?? `#${seat}`);
}

export function targetLabel(view: PlayerView, target: Target): string {
  const name = nameOf(view, target.seat);
  if (target.fromHand) return t("action.randomFromHand", { name });
  if (target.cardId) return `${name}: ${cardLabel(target.cardId)}`;
  return name;
}

export function choiceLabel(view: PlayerView, choice: Choice): { label: string; hint?: string } {
  switch (choice.kind) {
    case "character":
      return { label: characterName(choice.characterId), hint: characterRules(choice.characterId) };
    case "store_card":
      return { label: cardLabel(choice.cardId) };
    case "kit_return":
      return { label: t("action.returnCard", { card: cardLabel(choice.cardId) }) };
    case "draw":
      if (choice.from === "deck") return { label: t("action.drawDeck") };
      if (choice.from === "discard") {
        const top = view.discard.at(-1);
        return { label: `${t("action.drawDiscard")}${top ? `: ${cardLabel(top)}` : ""}` };
      }
      return { label: t("action.drawPlayer", { name: nameOf(view, choice.seat) }) };
  }
}

/** Text explaining the current prompt to the human. */
export function promptText(view: PlayerView): string {
  const prompt = view.prompt;
  if (!prompt) return "";
  switch (prompt.kind) {
    case "RESPOND_BANG":
      return t("prompt.RESPOND_BANG", { attacker: nameOf(view, prompt.attacker), needed: prompt.needed - prompt.got });
    case "DUEL":
      return t("prompt.DUEL", { opponent: nameOf(view, prompt.opponent) });
    case "DISCARD_EXCESS":
      return t("prompt.DISCARD_EXCESS", { count: prompt.count });
    case "MULTI_TARGET":
      return "";
    default:
      return t(`prompt.${prompt.kind}`);
  }
}
