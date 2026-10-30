import { CHARACTERS } from "../characters/data";
import { promptActor, type Prompt, type Seat, type TurnPhase } from "../state/types";
import { resolveMultiTarget } from "./cards/multi";
import { emit, nextLivingSeat, playerAt, pushPrompt, topPrompt, type Ctx } from "./context";
import { drawCards } from "./draw";

const MAX_STEPS = 10_000;

/**
 * Resolves automatic steps until a player must act or the game is over (docs/03 §2.3): driver prompts on top of
 * the stack are resolved here, a prompt with an actor means "wait", and an empty stack lets the turn phase move on.
 */
export function advance(ctx: Ctx): void {
  for (let step = 0; step < MAX_STEPS; step++) {
    if (ctx.s.winner) return;
    const top = topPrompt(ctx.s);
    if (top) {
      if (promptActor(top) !== null) return;
      resolveDriver(ctx, top);
      continue;
    }
    stepTurn(ctx);
  }
  throw new Error("advance: no progress after too many steps");
}

function resolveDriver(ctx: Ctx, prompt: Prompt): void {
  switch (prompt.kind) {
    case "MULTI_TARGET":
      resolveMultiTarget(ctx, prompt);
      return;
    default:
      throw new Error(`resolveDriver: ${prompt.kind} is not a driver prompt`);
  }
}

function setPhase(ctx: Ctx, phase: TurnPhase): void {
  ctx.s.turn.phase = phase;
  emit(ctx, { t: "PHASE", seat: ctx.s.turn.seat, phase });
}

function startTurn(ctx: Ctx, seat: Seat): void {
  const number = ctx.s.turn.number + 1;
  ctx.s.turn = { seat, number, phase: "start", bangsPlayed: 0 };
  emit(ctx, { t: "TURN_STARTED", seat, turn: number });
}

function stepTurn(ctx: Ctx): void {
  const { s } = ctx;
  const { seat, phase } = s.turn;

  if (phase === "setup") {
    finishSetup(ctx);
    return;
  }
  // R-5 / R-16: a player eliminated during their own turn loses the rest of it.
  if (!playerAt(s, seat).alive) {
    startTurn(ctx, nextLivingSeat(s, seat));
    return;
  }

  switch (phase) {
    case "start":
      // Start-of-turn checks (Dynamite, then Jail) arrive in Phase 3.
      setPhase(ctx, "draw");
      return;
    case "draw":
      // Character draw variants (Black Jack, Jesse, Kit, Pedro) arrive in Phase 4.
      drawCards(ctx, seat, 2);
      setPhase(ctx, "play");
      pushPrompt(ctx, { kind: "PLAY", seat });
      return;
    case "play": {
      // The PLAY prompt was popped by END_TURN.
      setPhase(ctx, "discard");
      const p = playerAt(s, seat);
      const excess = p.hand.length - p.life;
      if (excess > 0) pushPrompt(ctx, { kind: "DISCARD_EXCESS", seat, count: excess });
      return;
    }
    case "discard":
      startTurn(ctx, nextLivingSeat(s, seat));
      return;
  }
}

/** docs/02 §2.3–2.5: life from character (+1 Sheriff), starting hand = life, Sheriff starts. */
function finishSetup(ctx: Ctx): void {
  const { s } = ctx;
  for (const p of s.players) {
    if (p.characterId === null) throw new Error(`finishSetup: seat ${p.seat} has no character`);
    p.maxLife = CHARACTERS[p.characterId].life + (p.role === "sheriff" ? 1 : 0);
    p.life = p.maxLife;
  }
  for (const p of s.players) drawCards(ctx, p.seat, p.life);
  const sheriff = s.players.find((p) => p.role === "sheriff");
  if (!sheriff) throw new Error("finishSetup: no Sheriff");
  startTurn(ctx, sheriff.seat);
}
