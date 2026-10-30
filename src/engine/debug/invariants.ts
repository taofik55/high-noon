import { ALL_CARD_IDS } from "../cards/deck";
import { currentActor } from "../rules/legal";
import { promptActor, type GameState } from "../state/types";

/**
 * Structural checks every reachable state must pass (docs/06 §6). Used by the tests and the bot simulator.
 * Returns the broken invariants; empty means fine.
 */
export function checkInvariants(s: GameState): string[] {
  const problems: string[] = [];
  // General Store and Kit Carlson cards sit in their prompt until picked.
  const limbo = s.stack.flatMap((pr) => (pr.kind === "STORE_PICK" ? pr.revealed : pr.kind === "KIT_PICK" ? pr.cards : []));
  const all = [...s.deck, ...s.discard, ...limbo, ...s.players.flatMap((p) => [...p.hand, ...p.inPlay])];
  if (all.length !== ALL_CARD_IDS.length) problems.push(`card count ${all.length} != ${ALL_CARD_IDS.length}`);
  if (new Set(all).size !== all.length) problems.push("duplicate card ids across zones");

  for (const p of s.players) {
    if (p.life > p.maxLife) problems.push(`seat ${p.seat} life ${p.life} > max ${p.maxLife}`);
    if (!p.alive && (p.hand.length > 0 || p.inPlay.length > 0)) problems.push(`dead seat ${p.seat} holds cards`);
    const dying = s.stack.some((pr) => pr.kind === "DYING" && pr.seat === p.seat);
    // Life is dealt only once setup ends (choose_of_2 mode).
    if (s.turn.phase !== "setup" && p.alive && p.life <= 0 && !dying) problems.push(`seat ${p.seat} alive at ${p.life} life without DYING`);
  }
  if (s.players.filter((p) => p.role === "sheriff").length !== 1) problems.push("not exactly one Sheriff");
  if (s.winner && s.stack.length > 0) problems.push("game over but prompts remain");
  if (!s.winner && currentActor(s) === null) problems.push("no actor but game not over");
  for (const prompt of s.stack) {
    const actor = promptActor(prompt);
    if (actor !== null && !s.players[actor]?.alive) problems.push(`prompt ${prompt.kind} for dead seat ${actor}`);
  }
  const top = s.stack.at(-1);
  if (top && promptActor(top) === null) problems.push(`driver prompt ${top.kind} left unresolved on top`);
  return problems;
}
