import "server-only";

// docs/03 §6: a simple in-memory token bucket per user and instance is enough for a private game.
interface Bucket {
  tokens: number;
  at: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimit {
  /** Separate buckets per endpoint family. */
  name: string;
  capacity: number;
  refillPerSec: number;
}

/** Takes one token for `key`; false when the bucket is empty. `now` is injectable for tests. */
export function takeToken(key: string, limit: RateLimit, now: number = Date.now()): boolean {
  const prev = buckets.get(key) ?? { tokens: limit.capacity, at: now };
  const tokens = Math.min(limit.capacity, prev.tokens + ((now - prev.at) / 1000) * limit.refillPerSec);
  if (buckets.size > 10_000) buckets.clear(); // crude bound; a cleared bucket only means a fresh allowance
  if (tokens < 1) {
    buckets.set(key, { tokens, at: now });
    return false;
  }
  buckets.set(key, { tokens: tokens - 1, at: now });
  return true;
}
