import { describe, expect, it } from "vitest";
import { ALL_CARDS, CARD_TYPES_COUNT_FOR_TEST, getCard, isBlueCard, isWeapon } from "./helpers/deckFacts";

describe("deck (docs/02 §1.3, R-1)", () => {
  it("has exactly 80 cards with stable ids c01..c80", () => {
    expect(ALL_CARDS).toHaveLength(80);
    ALL_CARDS.forEach((card, i) => expect(card.id).toBe(`c${String(i + 1).padStart(2, "0")}`));
  });

  it("matches the count of every card type", () => {
    const counts: Record<string, number> = {};
    for (const card of ALL_CARDS) counts[card.type] = (counts[card.type] ?? 0) + 1;
    expect(counts).toEqual(CARD_TYPES_COUNT_FOR_TEST);
  });

  it("has 63 brown and 17 blue cards, weapons are blue", () => {
    expect(ALL_CARDS.filter((c) => !isBlueCard(c.type))).toHaveLength(63);
    expect(ALL_CARDS.filter((c) => isBlueCard(c.type))).toHaveLength(17);
    for (const c of ALL_CARDS) if (isWeapon(c.type)) expect(isBlueCard(c.type)).toBe(true);
  });

  it("gives every card a valid suit and rank", () => {
    for (const c of ALL_CARDS) {
      expect(["hearts", "diamonds", "clubs", "spades"]).toContain(c.suit);
      expect(c.rank).toBeGreaterThanOrEqual(2);
      expect(c.rank).toBeLessThanOrEqual(14);
    }
  });

  it("looks cards up by id and rejects unknown ids", () => {
    expect(getCard("c01").type).toBe("bang");
    expect(() => getCard("c99")).toThrow();
  });
});
