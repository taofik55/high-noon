import {
  ALL_CARD_IDS,
  applyAction,
  createRng,
  currentActor,
  expandLegalActions,
  getLegalActions,
  pick,
  type Action,
  type GameEvent,
  type GameState,
  type Seat,
} from "@/engine";

/** Returns a list of broken invariants (empty = fine). */
export function checkInvariants(s: GameState): string[] {
  const problems: string[] = [];
  const all = [...s.deck, ...s.discard, ...s.players.flatMap((p) => [...p.hand, ...p.inPlay])];
  if (all.length !== ALL_CARD_IDS.length) problems.push(`card count ${all.length} != ${ALL_CARD_IDS.length}`);
  if (new Set(all).size !== all.length) problems.push("duplicate card ids across zones");

  for (const p of s.players) {
    if (p.life > p.maxLife) problems.push(`seat ${p.seat} life ${p.life} > max ${p.maxLife}`);
    if (!p.alive && (p.hand.length > 0 || p.inPlay.length > 0)) problems.push(`dead seat ${p.seat} holds cards`);
    const dying = s.stack.some((pr) => pr.kind === "DYING" && pr.seat === p.seat);
    // Life is dealt only once setup ends (choose_of_2 mode).
    if (s.turn.phase !== "setup" && p.alive && p.life <= 0 && !dying) problems.push(`seat ${p.seat} alive at ${p.life} life without DYING`);
  }
  if (s.winner && s.stack.length > 0) problems.push("game over but prompts remain");
  if (!s.winner && currentActor(s) === null) problems.push("no actor but game not over");
  for (const prompt of s.stack) {
    if (!s.players[prompt.seat]?.alive) problems.push(`prompt ${prompt.kind} for dead seat ${prompt.seat}`);
  }
  return problems;
}

export interface RandomPlayResult {
  state: GameState;
  events: GameEvent[];
  actions: Array<[Seat, Action]>;
  steps: number;
}

/** Plays uniformly random legal actions, chosen by a separate seeded RNG, checking invariants after each step. */
export function playRandom(start: GameState, seed: string, maxSteps = 3000): RandomPlayResult {
  const rng = createRng(seed);
  let state = start;
  const events: GameEvent[] = [];
  const actions: Array<[Seat, Action]> = [];
  let steps = 0;
  while (!state.winner && steps < maxSteps) {
    const seat = currentActor(state);
    if (seat === null) throw new Error("no actor while game is running");
    const options = expandLegalActions(getLegalActions(state, seat), 20);
    if (options.length === 0) throw new Error(`seat ${seat} has no legal action`);
    const action = pick(rng, options);
    const r = applyAction(state, seat, action);
    state = r.state;
    events.push(...r.events);
    actions.push([seat, action]);
    steps++;
    const problems = checkInvariants(state);
    if (problems.length > 0) throw new Error(`invariants broken after step ${steps}: ${problems.join("; ")}`);
  }
  return { state, events, actions, steps };
}
