import { cardType, isBlueCard, type CardId, type GameEvent, type PlayerView, type Seat } from "@/engine";
import { CARD_NAMES, cardLabel, cardName, characterName } from "../cards";
import { t, type MessageKey } from "../i18n";

export type LogTone = "turn" | "attack" | "damage" | "heal" | "death" | "info" | "end";

export interface LogLine {
  text: string;
  tone: LogTone;
}

function nameOf(view: PlayerView, seat: Seat): string {
  return seat === view.viewer ? t("table.you") : (view.players[seat]?.name ?? `#${seat}`);
}

function cardList(ids: readonly CardId[] | undefined): string {
  return ids && ids.length > 0 ? ids.map(cardLabel).join(", ") : "";
}

/**
 * One human-readable (Bahasa Indonesia) log line per event, or null for bookkeeping events. Only uses what the event
 * and the viewer's own view contain, so it can never reveal more than the redacted event does.
 */
export function formatEvent(e: GameEvent, view: PlayerView): LogLine | null {
  const name = (seat: Seat) => nameOf(view, seat);
  switch (e.t) {
    case "GAME_STARTED":
      return { text: t("log.gameStarted", { n: e.seats.length }), tone: "info" };
    case "ROLE_ASSIGNED":
      if (e.seat === view.viewer) return { text: t("log.role", { role: t(`role.${e.role}`) }), tone: "info" };
      return e.role === "sheriff" ? { text: t("log.sheriff", { name: name(e.seat) }), tone: "info" } : null;
    case "CHARACTER_CHOSEN":
      return { text: t("log.character", { name: name(e.seat), character: characterName(e.characterId) }), tone: "info" };
    case "TURN_STARTED":
      return { text: t("log.turn", { turn: e.turn, name: name(e.seat) }), tone: "turn" };
    case "PHASE":
      return null;
    case "CARDS_DRAWN": {
      const cards = e.cardIds ? `: ${cardList(e.cardIds)}` : "";
      if (e.from === "discard") return { text: t("log.drawnDiscard", { name: name(e.seat), cards: cardList(e.cardIds) }), tone: "info" };
      if (e.from === "player" && e.fromSeat !== undefined) {
        return { text: t("log.drawnPlayer", { name: name(e.seat), from: name(e.fromSeat), cards }), tone: "info" };
      }
      return { text: t("log.drawn", { name: name(e.seat), count: e.count, cards }), tone: "info" };
    }
    case "CARD_REVEALED":
      return { text: t("log.revealed", { name: name(e.seat), card: cardLabel(e.cardId) }), tone: "info" };
    case "DRAW_CHECK": {
      const reason = e.reason === "jourdonnais" ? "Jourdonnais" : CARD_NAMES[e.reason];
      const result = t(e.success ? "log.drawCheck.success" : "log.drawCheck.fail");
      const shown = e.cardIds.length > 1 ? `${cardLabel(e.chosen)} [${cardList(e.cardIds)}]` : cardLabel(e.chosen);
      return { text: t("log.drawCheck", { name: name(e.seat), reason, card: shown, result }), tone: "info" };
    }
    case "CARD_PLAYED": {
      const type = cardType(e.cardId);
      // Said better by the event that follows: EQUIPPED / JAILED for blue cards, MISSED for a Missed! (or Calamity's
      // BANG!) played as a response.
      if (isBlueCard(type)) return null;
      if (!e.asType && !e.target && (type === "missed" || type === "bang")) return null;
      const as = e.asType ? ` → ${CARD_NAMES[e.asType]}` : "";
      let target = "";
      if (e.target?.seat !== undefined) {
        const what = e.target.cardId ? ` (${cardName(e.target.cardId)})` : "";
        target = ` → ${name(e.target.seat)}${what}`;
      }
      const tone: LogTone = type === "beer" || type === "saloon" ? "heal" : e.target ? "attack" : "info";
      return { text: t("log.played", { name: name(e.seat), card: cardLabel(e.cardId), as, target }), tone };
    }
    case "EQUIPPED":
      return { text: t("log.equipped", { name: name(e.seat), card: cardLabel(e.cardId) }), tone: "info" };
    case "JAILED":
      return { text: t("log.jailed", { name: name(e.seat), by: name(e.by) }), tone: "attack" };
    case "SHOT":
      // A BANG! shot is already logged by its CARD_PLAYED line; Gatling and Duel shots are not.
      return e.source === "bang" ? null : { text: t("log.shot", { from: name(e.from), to: name(e.to) }), tone: "attack" };
    case "MISSED": {
      const via = e.via === "missed" ? "Missed!" : e.via === "barrel" ? "Barrel" : e.via === "jourdonnais" ? "Jourdonnais" : "Calamity Janet";
      return { text: t("log.missed", { name: name(e.seat), via }), tone: "info" };
    }
    case "DUEL_ROUND":
      return e.discarded
        ? { text: t("log.duelRound", { name: name(e.seat), card: cardLabel(e.discarded) }), tone: "attack" }
        : { text: t("log.duelGiveUp", { name: name(e.seat) }), tone: "attack" };
    case "INDIANS_DEFENDED":
      return { text: t("log.indiansDefended", { name: name(e.seat), card: cardLabel(e.cardId) }), tone: "info" };
    case "INDIANS_HIT":
      return { text: t("log.indiansHit", { name: name(e.seat) }), tone: "attack" };
    case "DAMAGED":
      return { text: t("log.damaged", { name: name(e.seat), amount: e.amount }), tone: "damage" };
    case "HEALED":
      return { text: t("log.healed", { name: name(e.seat), amount: e.amount }), tone: "heal" };
    case "CARD_STOLEN":
      return {
        text: t("log.stolen", { to: name(e.to), from: name(e.from), card: e.cardId ? cardLabel(e.cardId) : t("log.aCard") }),
        tone: "attack",
      };
    case "CARD_DISCARDED":
      return { text: t("log.discarded", { name: name(e.seat), cards: cardList(e.cardIds) }), tone: "info" };
    case "DYNAMITE_PASSED":
      return { text: t("log.dynamitePassed", { from: name(e.from), to: name(e.to) }), tone: "info" };
    case "DYNAMITE_EXPLODED":
      return { text: t("log.dynamiteExploded", { name: name(e.seat) }), tone: "damage" };
    case "JAIL_RESULT":
      return { text: t(e.escaped ? "log.jailResult.escaped" : "log.jailResult.stays", { name: name(e.seat) }), tone: "info" };
    case "STORE_REVEALED":
      return { text: t("log.storeRevealed", { cards: cardList(e.cardIds) }), tone: "info" };
    case "STORE_PICKED":
      return { text: t("log.storePicked", { name: name(e.seat), card: cardLabel(e.cardId) }), tone: "info" };
    case "ABILITY_USED":
      return { text: t("log.ability", { name: name(e.seat), character: characterName(e.ability) }), tone: "heal" };
    case "ELIMINATED":
      return { text: t("log.eliminated", { name: name(e.seat), role: t(`role.${e.role}`) }), tone: "death" };
    case "CARDS_INHERITED":
      return { text: t("log.inherited", { name: name(e.seat), from: name(e.from) }), tone: "info" };
    case "REWARD":
      return { text: t(`log.reward.${e.kind}` as MessageKey, { name: name(e.seat) }), tone: e.kind === "outlaw_bounty" ? "info" : "damage" };
    case "DECK_RESHUFFLED":
      return { text: t("log.reshuffled", { size: e.size }), tone: "info" };
    case "GAME_OVER":
      return { text: `${t("log.gameOver")} ${t(`winner.${e.winner}`)}`, tone: "end" };
  }
}
