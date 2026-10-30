import {
  applyAction,
  checkInvariants,
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

export { checkInvariants };

export interface RandomPlayResult {
  state: GameState;
  events: GameEvent[];
  actions: Array<[Seat, Action]>;
  steps: number;
}

export type StepHook = (before: GameState, seat: Seat, action: Action, after: GameState, events: GameEvent[]) => void;

/** Plays uniformly random legal actions, chosen by a separate seeded RNG, checking invariants after each step. */
export function playRandom(start: GameState, seed: string, maxSteps = 3000, onStep?: StepHook): RandomPlayResult {
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
    onStep?.(state, seat, action, r.state, r.events);
    state = r.state;
    events.push(...r.events);
    actions.push([seat, action]);
    steps++;
    const problems = checkInvariants(state);
    if (problems.length > 0) throw new Error(`invariants broken after step ${steps}: ${problems.join("; ")}`);
  }
  return { state, events, actions, steps };
}
