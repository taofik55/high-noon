import { describe, expect, it } from "vitest";
import { createRng, nextUint32, randomInt, shuffle } from "@/engine";

describe("seeded RNG", () => {
  it("is deterministic per seed and differs across seeds", () => {
    const a = createRng("seed-1");
    const b = createRng("seed-1");
    const c = createRng("seed-2");
    const seqA = Array.from({ length: 20 }, () => nextUint32(a));
    const seqB = Array.from({ length: 20 }, () => nextUint32(b));
    const seqC = Array.from({ length: 20 }, () => nextUint32(c));
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
  });

  it("survives a JSON round trip mid-stream (state is stored as jsonb)", () => {
    const a = createRng("roundtrip");
    nextUint32(a);
    const b = JSON.parse(JSON.stringify(a)) as typeof a;
    expect(Array.from({ length: 10 }, () => nextUint32(a))).toEqual(Array.from({ length: 10 }, () => nextUint32(b)));
  });

  it("keeps state as uint32 values", () => {
    const rng = createRng("u32");
    for (let i = 0; i < 100; i++) nextUint32(rng);
    for (const v of rng) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(2 ** 32);
    }
  });

  it("randomInt stays in range and hits every value", () => {
    const rng = createRng("range");
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = randomInt(rng, 7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
      seen.add(v);
    }
    expect(seen.size).toBe(7);
    expect(() => randomInt(rng, 0)).toThrow();
  });

  it("shuffle returns a permutation", () => {
    const items = Array.from({ length: 80 }, (_, i) => i);
    const shuffled = shuffle(createRng("perm"), [...items]);
    expect([...shuffled].sort((x, y) => x - y)).toEqual(items);
    expect(shuffled).not.toEqual(items);
  });
});
