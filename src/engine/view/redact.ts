import type { GameEvent } from "../events/types";
import type { Viewer } from "./playerView";

/**
 * Removes what `viewer` must not learn from an event (docs/03 §2.6, Golden rule 4); null = the event is not shown
 * at all. Never mutates the input.
 */
export function redactEvent(event: GameEvent, viewer: Viewer): GameEvent | null {
  switch (event.t) {
    case "ROLE_ASSIGNED":
      return event.seat === viewer || event.role === "sheriff" ? event : null;

    case "CARDS_DRAWN": {
      // Discard-pile draws (Pedro Ramirez) are public; Jesse Jones' victim knows which card was taken.
      const knows = event.from === "discard" || event.seat === viewer || (event.from === "player" && event.fromSeat === viewer);
      if (knows) return event;
      const copy = { ...event };
      delete copy.cardIds;
      return copy;
    }

    case "CARD_STOLEN": {
      if (!event.fromHand || event.from === viewer || event.to === viewer) return event;
      const copy = { ...event };
      delete copy.cardId;
      return copy;
    }

    case "CARDS_INHERITED": {
      if (event.seat === viewer || event.from === viewer) return event;
      const copy = { ...event };
      delete copy.handCardIds;
      return copy;
    }

    default:
      return event;
  }
}
