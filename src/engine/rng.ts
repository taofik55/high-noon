// Seeded, serializable PRNG (sfc32). The state is a plain array of uint32 so it survives JSON/jsonb round trips,
// which keeps games deterministic across client, server and simulator (Golden rule 1, T-51).

export type RngState = [number, number, number, number];

/** cyrb128 string hash: spreads any seed string over 128 bits for sfc32. */
function cyrb128(str: string): RngState {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044813);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044813);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export function createRng(seed: string): RngState {
  const rng = cyrb128(seed);
  // Discard early outputs: sfc32 needs a few rounds to mix low-entropy seeds.
  for (let i = 0; i < 15; i++) nextUint32(rng);
  return rng;
}

/** Advances `rng` in place and returns a uint32. */
export function nextUint32(rng: RngState): number {
  let [a, b, c, d] = rng;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  rng[0] = a >>> 0;
  rng[1] = b >>> 0;
  rng[2] = c >>> 0;
  rng[3] = d >>> 0;
  return t >>> 0;
}

/** Unbiased integer in [0, n). Advances `rng` in place. */
export function randomInt(rng: RngState, n: number): number {
  if (!Number.isInteger(n) || n <= 0) throw new Error(`randomInt: invalid bound ${n}`);
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  let x = nextUint32(rng);
  while (x >= limit) x = nextUint32(rng);
  return x % n;
}

/** Fisher–Yates shuffle of `items` in place. Advances `rng` in place. */
export function shuffle<T>(rng: RngState, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    const tmp = items[i] as T;
    items[i] = items[j] as T;
    items[j] = tmp;
  }
  return items;
}

/** Uniformly picks one element. Advances `rng` in place. */
export function pick<T>(rng: RngState, items: readonly T[]): T {
  if (items.length === 0) throw new Error("pick: empty list");
  return items[randomInt(rng, items.length)] as T;
}
