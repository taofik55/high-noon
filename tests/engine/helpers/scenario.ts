import {
  ALL_CARDS,
  CHARACTERS,
  applyAction,
  createRng,
  getCard,
  type Action,
  type CardId,
  type CardType,
  type CharacterId,
  type GameEvent,
  type GameState,
  type PlayerState,
  type Prompt,
  type Rank,
  type Role,
  type Seat,
  type Suit,
  type TurnPhase,
} from "@/engine";

/** A card picked from the real 80-card deck: by type, or by any combination of type/suit/rank. */
export type CardSpec = CardType | { type?: CardType; suit?: Suit; rank?: Rank };

export interface PlayerSpec {
  name?: string;
  character?: CharacterId;
  role?: Role;
  life?: number;
  maxLife?: number;
  hand?: CardSpec[];
  inPlay?: CardSpec[];
  alive?: boolean;
  isNpc?: boolean;
}

export interface ScenarioSpec {
  /** Player specs in seat order, or just a player count. */
  players: PlayerSpec[] | number;
  /** Cards on top of the deck, deckTop[0] is drawn first. */
  deckTop?: CardSpec[];
  /** Discard pile bottom → top. */
  discard?: CardSpec[];
  /** Where the unassigned cards go (default: under deckTop). "none" breaks 80-card conservation on purpose. */
  leftover?: "deck" | "discard" | "none";
  turn?: { seat?: Seat; phase?: TurnPhase; number?: number; bangsPlayed?: number };
  /** Defaults to a PLAY prompt for the turn seat when the phase is "play", otherwise empty. */
  stack?: Prompt[];
  seed?: string;
}

/** Same layout as the 4–7 player role tables (docs/02 §1.1), Sheriff in seat 0. */
const DEFAULT_ROLES: Role[] = ["sheriff", "outlaw", "outlaw", "renegade", "deputy", "outlaw", "deputy"];

// Defaults avoid characters whose abilities touch BANG!, damage, distance or elimination. Tests that exercise
// draw phases or abilities must set characters explicitly.
const DEFAULT_CHARACTERS: CharacterId[] = [
  "lucky_duke",
  "black_jack",
  "kit_carlson",
  "jesse_jones",
  "pedro_ramirez",
  "sid_ketchum",
  "willy_the_kid",
];

function matches(cardId: CardId, spec: CardSpec): boolean {
  const card = getCard(cardId);
  if (typeof spec === "string") return card.type === spec;
  return (
    (spec.type === undefined || card.type === spec.type) &&
    (spec.suit === undefined || card.suit === spec.suit) &&
    (spec.rank === undefined || card.rank === spec.rank)
  );
}

/** Builds an exact GameState for a test. Cards come from the real deck so ids and suits stay consistent. */
export function scenario(spec: ScenarioSpec): GameState {
  const pool: CardId[] = ALL_CARDS.map((c) => c.id);
  const take = (cardSpec: CardSpec): CardId => {
    const i = pool.findIndex((id) => matches(id, cardSpec));
    if (i < 0) throw new Error(`scenario: no card left matching ${JSON.stringify(cardSpec)}`);
    return pool.splice(i, 1)[0] as CardId;
  };

  const specs: PlayerSpec[] = typeof spec.players === "number" ? Array.from({ length: spec.players }, () => ({})) : spec.players;
  const n = specs.length;

  const players: PlayerState[] = specs.map((ps, seat) => {
    const role = ps.role ?? (DEFAULT_ROLES[seat] as Role);
    const characterId = ps.character ?? (DEFAULT_CHARACTERS[seat] as CharacterId);
    const maxLife = ps.maxLife ?? CHARACTERS[characterId].life + (role === "sheriff" ? 1 : 0);
    const alive = ps.alive ?? true;
    return {
      seat,
      name: ps.name ?? `P${seat}`,
      characterId,
      role,
      life: alive ? (ps.life ?? maxLife) : 0,
      maxLife,
      hand: (ps.hand ?? []).map(take),
      inPlay: (ps.inPlay ?? []).map(take),
      alive,
      isNpc: ps.isNpc ?? false,
    };
  });

  const deckTop = (spec.deckTop ?? []).map(take);
  const discard = (spec.discard ?? []).map(take);
  const leftover = spec.leftover ?? "deck";
  const deck = leftover === "deck" ? [...deckTop, ...pool] : deckTop;
  if (leftover === "discard") discard.unshift(...pool);

  const turnSeat = spec.turn?.seat ?? 0;
  const phase = spec.turn?.phase ?? "play";
  const stack: Prompt[] = spec.stack ?? (phase === "play" ? [{ kind: "PLAY", seat: turnSeat }] : []);

  return {
    schemaVersion: 1,
    config: {
      players: players.map((p) => ({ name: p.name, isNpc: p.isNpc })),
      characterMode: "random",
    },
    rng: createRng(spec.seed ?? "scenario"),
    deck,
    discard,
    players,
    turn: { seat: turnSeat, number: spec.turn?.number ?? 1, phase, bangsPlayed: spec.turn?.bangsPlayed ?? 0 },
    stack,
    winner: null,
    stats: Array.from({ length: n }, () => ({ damageDealt: 0, kills: 0, cardsPlayed: 0 })),
  };
}

/** Card ids of a given type in a seat's hand. */
export function handOf(s: GameState, seat: Seat, type: CardType): CardId[] {
  return (s.players[seat]?.hand ?? []).filter((id) => getCard(id).type === type);
}

export function firstInHand(s: GameState, seat: Seat, type: CardType): CardId {
  const id = handOf(s, seat, type)[0];
  if (!id) throw new Error(`seat ${seat} has no ${type} in hand`);
  return id;
}

export function player(s: GameState, seat: Seat): PlayerState {
  const p = s.players[seat];
  if (!p) throw new Error(`no seat ${seat}`);
  return p;
}

export interface Run {
  state: GameState;
  events: GameEvent[];
}

/** Applies a sequence of [seat, action] pairs, collecting all events. */
export function run(state: GameState, steps: Array<[Seat, Action]>): Run {
  let s = state;
  const events: GameEvent[] = [];
  for (const [seat, action] of steps) {
    const r = applyAction(s, seat, action);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

export function eventsOf<T extends GameEvent["t"]>(events: GameEvent[], t: T): Extract<GameEvent, { t: T }>[] {
  return events.filter((e): e is Extract<GameEvent, { t: T }> => e.t === t);
}

/** Recursively freezes a value so any mutation of an input state throws in tests. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}
