import type { CardId } from "../cards/types";
import type { CharacterId } from "../characters/data";
import { currentActor, getLegalActions } from "../rules/legal";
import { topPrompt } from "../rules/context";
import type { LegalAction } from "../rules/actions";
import type { GameState, Prompt, Role, Seat, SeatStats, TurnState, Winner } from "../state/types";

export type Viewer = Seat | "spectator";

export interface PublicPlayer {
  seat: Seat;
  name: string;
  characterId: CharacterId | null;
  /** Clamped at 0 for display (R-14 allows negative life internally). */
  life: number;
  maxLife: number;
  handCount: number;
  inPlay: CardId[];
  alive: boolean;
  isNpc: boolean;
  /** Only for yourself, the Sheriff, eliminated players, and everyone once the game is over (Golden rule 4). */
  role: Role | null;
}

/** The top prompt as the viewer may see it: Kit's cards and the characters offered to others are hidden. */
export type ViewPrompt =
  | Exclude<Prompt, { kind: "KIT_PICK" } | { kind: "CHOOSE_CHARACTER" }>
  | { kind: "KIT_PICK"; seat: Seat; cards?: CardId[] }
  | { kind: "CHOOSE_CHARACTER"; seat: Seat; options?: [CharacterId, CharacterId] };

/**
 * Everything one seat may know (docs/03 §2.6). Card ids resolve through the static deck data (getCard), which is
 * public. Never contains other players' hands, the deck order or the RNG state.
 */
export interface PlayerView {
  schemaVersion: 1;
  viewer: Viewer;
  /** Empty for spectators. */
  myHand: CardId[];
  myRole: Role | null;
  players: PublicPlayer[];
  deckCount: number;
  /** The whole discard pile (every card in it was shown face up), bottom → top. */
  discard: CardId[];
  turn: TurnState;
  prompt: ViewPrompt | null;
  currentActor: Seat | null;
  /** Empty unless the viewer is the one to act. */
  legalActions: LegalAction[];
  winner: Winner | null;
  stats: SeatStats[];
}

function viewPrompt(prompt: Prompt | undefined, viewer: Viewer): ViewPrompt | null {
  if (!prompt) return null;
  if (prompt.kind === "KIT_PICK" && prompt.seat !== viewer) return { kind: "KIT_PICK", seat: prompt.seat };
  if (prompt.kind === "CHOOSE_CHARACTER" && prompt.seat !== viewer) return { kind: "CHOOSE_CHARACTER", seat: prompt.seat };
  return structuredClone(prompt);
}

export function toPlayerView(s: GameState, viewer: Viewer): PlayerView {
  const me = viewer === "spectator" ? undefined : s.players[viewer];
  const gameOver = s.winner !== null;
  return {
    schemaVersion: 1,
    viewer,
    myHand: me ? [...me.hand] : [],
    myRole: me ? me.role : null,
    players: s.players.map((p) => ({
      seat: p.seat,
      name: p.name,
      characterId: p.characterId,
      life: Math.max(0, p.life),
      maxLife: p.maxLife,
      handCount: p.hand.length,
      inPlay: [...p.inPlay],
      alive: p.alive,
      isNpc: p.isNpc,
      role: gameOver || p.seat === viewer || p.role === "sheriff" || !p.alive ? p.role : null,
    })),
    deckCount: s.deck.length,
    discard: [...s.discard],
    turn: { ...s.turn },
    prompt: viewPrompt(topPrompt(s), viewer),
    currentActor: currentActor(s),
    legalActions: viewer === "spectator" ? [] : getLegalActions(s, viewer),
    winner: s.winner,
    stats: s.stats.map((st) => ({ ...st })),
  };
}
