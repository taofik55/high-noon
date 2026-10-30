import {
  ALL_CARD_IDS,
  createRng,
  nextUint32,
  randomInt,
  rolesFor,
  shuffle,
  type CardId,
  type GameState,
  type PlayerState,
  type PlayerView,
  type RngState,
  type Role,
} from "@/engine";
import type { AiMemory } from "./types";
import { mySeat } from "./lib/view";

function weightedPick<T>(rng: RngState, items: readonly T[], weight: (item: T) => number): number {
  const weights = items.map(weight);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = (randomInt(rng, 1_000_000) / 1_000_000) * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i] ?? 0;
    if (r < 0) return i;
  }
  return items.length - 1;
}

/** Hidden roles drawn from the remaining role pool, weighted by suspicion (docs/06 §3 posterior, roughly). */
function sampleRoles(view: PlayerView, memory: AiMemory, rng: RngState): Role[] {
  const roles: (Role | null)[] = view.players.map((p) => p.role ?? memory.knownRoles[p.seat] ?? null);
  const pool = rolesFor(view.players.length);
  for (const role of roles) {
    if (role === null) continue;
    const i = pool.indexOf(role);
    if (i >= 0) pool.splice(i, 1);
  }
  const unknown = shuffle(
    rng,
    roles.flatMap((r, seat) => (r === null ? [seat] : [])),
  );
  for (const seat of unknown) {
    const s = memory.suspicion[seat] ?? 0;
    const i = weightedPick(rng, pool, (role) => (role === "deputy" ? 0.25 + (1 - s) / 2 : 0.25 + (1 + s) / 2));
    roles[seat] = pool.splice(i, 1)[0] ?? "outlaw";
  }
  return roles.map((r) => r ?? "outlaw");
}

/**
 * One plausible full game state consistent with everything this NPC can see (docs/06 §4 Hard): its own hand, all
 * public zones, hand counts; hidden hands and the deck order come from a shuffle of the unseen cards, hidden roles from
 * the suspicion-weighted pool. Built from the view only, so the hard bot cannot cheat (Golden rule 9).
 * Only valid while the NPC is at its own PLAY prompt, where the whole prompt stack is known to be `[PLAY]`.
 */
export function determinize(view: PlayerView, memory: AiMemory, rng: RngState): GameState {
  const seat = mySeat(view);
  if (view.prompt?.kind !== "PLAY" || view.prompt.seat !== seat) throw new Error("determinize: only at own PLAY prompt");

  const seen = new Set<CardId>([...view.myHand, ...view.discard, ...view.players.flatMap((p) => p.inPlay)]);
  const unseen = shuffle(
    rng,
    ALL_CARD_IDS.filter((id) => !seen.has(id)),
  );
  const roles = sampleRoles(view, memory, rng);

  const players: PlayerState[] = view.players.map((p) => ({
    seat: p.seat,
    name: p.name,
    characterId: p.characterId,
    role: roles[p.seat] ?? "outlaw",
    life: p.life,
    maxLife: p.maxLife,
    hand: p.seat === seat ? [...view.myHand] : unseen.splice(0, p.handCount),
    inPlay: [...p.inPlay],
    alive: p.alive,
    isNpc: true,
  }));

  return {
    schemaVersion: 1,
    config: { players: view.players.map((p) => ({ name: p.name, isNpc: true })), characterMode: "random" },
    rng: createRng(`world:${nextUint32(rng)}`),
    deck: unseen,
    discard: [...view.discard],
    players,
    turn: { ...view.turn },
    stack: [{ kind: "PLAY", seat }],
    winner: null,
    stats: view.stats.map((st) => ({ ...st })),
  };
}
