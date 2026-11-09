import { describe, expect, it } from "vitest";
import { ALL_CARD_IDS, CHARACTER_IDS } from "@/engine";
import { ASSETS, resolveAsset } from "@/game3d/assets/manifest";
import { cardFace } from "@/game3d/cards/cardFace";
import { fanLayout } from "@/game3d/hand/fanLayout";
import { AUTO_POLICY, QUALITIES, QUALITY_CONFIG, governorStep, initialGovernor, pickLod, resolveQuality, stepDown, type Governor } from "@/game3d/settings/quality";
import { BUILDINGS, SEAT_RADIUS, TABLE_CAMERA, facingCenter, focusCamera, seatPosition, towardsCenter } from "@/game3d/world/layout";

describe("seat layout (docs/05 §2)", () => {
  it.each([4, 5, 6, 7])("puts me at the front and the others clockwise (to my left first) for %i players", (n) => {
    for (let me = 0; me < n; me++) {
      const mine = seatPosition(me, me, n);
      expect(mine[0]).toBeCloseTo(0);
      expect(mine[2]).toBeCloseTo(SEAT_RADIUS);
      // The next seat clockwise is on my left, i.e. −x as seen from the camera behind me.
      expect(seatPosition((me + 1) % n, me, n)[0]).toBeLessThan(0);
      expect(seatPosition((me + n - 1) % n, me, n)[0]).toBeGreaterThan(0);
      for (let s = 0; s < n; s++) {
        const [x, , z] = seatPosition(s, me, n);
        expect(Math.hypot(x, z)).toBeCloseTo(SEAT_RADIUS, 2);
      }
    }
  });

  it("characters face the center and crates sit between them and the center", () => {
    const pos = seatPosition(2, 0, 5);
    const ry = facingCenter(pos);
    // Rotating +z by ry must point at the origin.
    const dir = [Math.sin(ry), Math.cos(ry)];
    const toCenter = [-pos[0] / SEAT_RADIUS, -pos[2] / SEAT_RADIUS];
    expect(dir[0]).toBeCloseTo(toCenter[0] ?? 0);
    expect(dir[1]).toBeCloseTo(toCenter[1] ?? 0);
    const crate = towardsCenter(pos, 1.6);
    expect(Math.hypot(crate[0], crate[2])).toBeCloseTo(SEAT_RADIUS - 1.6, 2);
  });

  it("the TABLE camera looks over my shoulder; FOCUS moves towards the seat", () => {
    expect(TABLE_CAMERA.position[2]).toBeGreaterThan(SEAT_RADIUS);
    const seat = seatPosition(3, 0, 6);
    const focus = focusCamera(seat);
    const before = Math.hypot(TABLE_CAMERA.position[0] - seat[0], TABLE_CAMERA.position[2] - seat[2]);
    const after = Math.hypot(focus.position[0] - seat[0], focus.position[2] - seat[2]);
    expect(after).toBeLessThan(before);
    expect(focus.target).toEqual([seat[0], 1.2, seat[2]]);
  });

  it("buildings stay outside the seat ring", () => {
    for (const b of BUILDINGS) expect(Math.hypot(b.position[0], b.position[2])).toBeGreaterThan(SEAT_RADIUS + 6);
  });
});

describe("quality presets (docs/05 §8)", () => {
  it("scale up from low to ultra", () => {
    const sizes = QUALITIES.map((q) => QUALITY_CONFIG[q].shadowMapSize);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
    expect(QUALITY_CONFIG.low.shadows).toBe(false);
    expect(QUALITY_CONFIG.ultra.dpr[1]).toBeGreaterThan(QUALITY_CONFIG.low.dpr[1]);
  });

  it("auto steps down and resolves to its current level", () => {
    expect(stepDown("ultra")).toBe("high");
    expect(stepDown("low")).toBe("low");
    expect(resolveQuality("auto", "medium")).toBe("medium");
    expect(resolveQuality("ultra", "low")).toBe("ultra");
  });

  it("add post-processing passes level by level, as in the docs/05 §8 table", () => {
    const { low, medium, high, ultra } = QUALITY_CONFIG;
    expect(low.post).toBeNull();
    expect(medium.post).toMatchObject({ bloom: true, ssao: false, vignette: false, cinematicDof: false, grain: false });
    expect(high.post).toMatchObject({ bloom: true, ssao: true, vignette: true, cinematicDof: false, grain: false });
    expect(ultra.post).toMatchObject({ bloom: true, ssao: true, vignette: true, cinematicDof: true, grain: true });
    expect(QUALITIES.map((q) => QUALITY_CONFIG[q].particles)).toEqual([0.25, 0.5, 1, 1]);
    expect(QUALITIES.map((q) => QUALITY_CONFIG[q].shadowMapSize).slice(1)).toEqual([1024, 2048, 4096]);
  });

  it("picks character LOD by distance with hysteresis; low always uses LOD1", () => {
    expect(pickLod(0, 5, 0)).toBe(1);
    expect(pickLod(0, 16, 16)).toBe(0);
    expect(pickLod(0, 17, 16)).toBe(1);
    expect(pickLod(1, 15.5, 16)).toBe(1);
    expect(pickLod(1, 15, 16)).toBe(0);
  });
});

describe("auto quality governor (docs/05 §8: fps < 50 for 3 s)", () => {
  const run = (fps: number, seconds: number, g: Governor = initialGovernor()) => {
    let steps = 0;
    for (let t = 0; t < seconds; t += 1 / fps) {
      const r = governorStep(g, 1 / fps);
      g = r.next;
      if (r.stepDown) steps++;
    }
    return { g, steps };
  };

  it("never steps down at 60 fps", () => {
    expect(run(60, 30).steps).toBe(0);
  });

  it("steps down once after settling plus 3 s at 30 fps, then waits for the new level to settle", () => {
    expect(run(30, AUTO_POLICY.settle + 2).steps).toBe(0);
    expect(run(30, AUTO_POLICY.settle + AUTO_POLICY.slowFor + 0.6).steps).toBe(1);
  });

  it("a short dip does not count, and a hidden-tab frame is ignored", () => {
    let { g } = run(60, 5);
    ({ g } = run(30, 2, g));
    const back = run(60, 2, g);
    expect(back.g.slow).toBe(0);
    expect(governorStep(back.g, 4).stepDown).toBe(false);
    expect(governorStep(back.g, 4).next).toBe(back.g);
  });
});

describe("asset manifest (docs/07 §4, Golden rule 6)", () => {
  it("has an entry with a placeholder fallback for every character", () => {
    for (const id of CHARACTER_IDS) expect(ASSETS[`char.${id}`]?.fallback).toBe("placeholder.capsule");
  });

  it("every entry has a fallback and resolves to the placeholder until a file is set", () => {
    for (const [id, entry] of Object.entries(ASSETS)) {
      expect(entry.fallback).toMatch(/^placeholder\./);
      expect(resolveAsset(id)).toEqual(entry.url ? { source: "gltf", url: entry.url } : { source: "placeholder", placeholder: entry.fallback });
    }
    expect(resolveAsset("nope")).toEqual({ source: "placeholder", placeholder: "placeholder.none" });
  });
});

describe("generated card faces (docs/05 §11)", () => {
  it("shows English names, rank+suit, brown/blue family and rules text for all 80 cards", () => {
    for (const id of ALL_CARD_IDS) {
      const face = cardFace(id);
      expect(face.title.length).toBeGreaterThan(2);
      expect(face.corner).toMatch(/^(10|[2-9JQKA])[♥♦♣♠]$/);
      expect(face.rules.length).toBeGreaterThan(5);
    }
    expect(cardFace("c01")).toMatchObject({ title: "BANG!", family: "brown" });
    const barrel = ALL_CARD_IDS.find((id) => cardFace(id).title === "Barrel");
    expect(barrel && cardFace(barrel).family).toBe("blue");
  });
});

describe("hand fan layout (docs/05 §4)", () => {
  it("is centered, symmetric, and fits the screen width", () => {
    const slots = fanLayout(7, 1440, 900);
    expect(slots).toHaveLength(7);
    expect(slots[3]?.x).toBeCloseTo(0);
    expect(slots[0]?.x).toBeCloseTo(-(slots[6]?.x ?? 0));
    expect(Math.abs(slots[0]?.x ?? 0)).toBeLessThan(1440 / 2);
    // The middle card sits highest.
    for (const s of slots) expect(s.y).toBeLessThanOrEqual(slots[3]?.y ?? 0);
  });

  it("squeezes big hands into the same width", () => {
    const wide = fanLayout(15, 1000, 800);
    expect((wide.at(-1)?.x ?? 0) - (wide[0]?.x ?? 0)).toBeLessThanOrEqual(1000 * 0.55);
  });
});
