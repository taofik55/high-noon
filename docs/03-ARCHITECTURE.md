# 03 — Architecture

## 1. Big picture

```
                    ┌──────────────────────────── Browser ────────────────────────────┐
                    │  UI (React, HUD)  ◄──── presentedView ────┐                     │
                    │       │ intents                            │                     │
                    │       ▼                                    │                     │
                    │  GameAdapter ──► updates {events, view} ──► Director (3D queue)  │
                    │   ├─ LocalAdapter  (solo: engine + AI in Web Worker)             │
                    │   └─ OnlineAdapter (Supabase realtime + fetch)                   │
                    └───────────┬───────────────────────────────────▲─────────────────┘
                                │ POST /api/games/:id/action        │ realtime: player_views change
                                ▼                                   │ fetch: game_events > lastVersion
                ┌──────────── Vercel (Next.js route handlers) ──────┴──────┐
                │ gameService: auth → load → engine.applyAction →          │
                │ NPC loop (ai.decide on NPC PlayerView) → redact → commit │
                └───────────────────────────┬──────────────────────────────┘
                                            │ rpc commit_game_action (service role)
                                ┌───────────▼────────────┐
                                │ Supabase Postgres + RLS│  games (secret state)
                                │ Realtime, Auth          │  player_views, game_events …
                                └────────────────────────┘
```

Key decisions:
- **Authoritative server = Next.js route handlers on Vercel** (Node runtime). Same TypeScript engine imported directly,
  no Deno/edge bundling problems. Turn-based traffic is light, serverless latency is fine.
- **No timers on the server.** Deadlines are stored in the DB; any client may call `/timeout` after a deadline passes and
  the server verifies with `now()`.
- **NPC turns are computed synchronously** inside the same request (loop until a human must act). The client inserts
  "thinking" pauses when presenting, so NPCs feel natural without server-side sleeping.
- **Solo mode never touches the server.**

## 2. Engine (`src/engine`)

### 2.1 Public API
```ts
createGame(config: GameConfig, seed: string): { state: GameState; events: GameEvent[] }
getLegalActions(state: GameState, seat: Seat): LegalAction[]     // empty if seat is not the one to act
applyAction(state: GameState, seat: Seat, action: Action): { state: GameState; events: GameEvent[] } // throws IllegalActionError
currentActor(state: GameState): Seat | null                      // seat that must act now (top of prompt stack)
toPlayerView(state: GameState, seat: Seat): PlayerView
redactEvent(event: GameEvent, viewerSeat: Seat | 'spectator'): GameEvent | null
defaultActionOnTimeout(state: GameState, seat: Seat): Action      // safest legal action (take hit, end turn, discard random…)
```
State is treated as immutable: `applyAction` makes one `structuredClone` of the input and the rule helpers mutate that
private draft (`rules/context.ts` `Ctx`). Tests deep-freeze inputs to prove callers' states are never touched.
Extra helpers: `whyIllegal(state, seat, action) → string | null`, `isActionLegal`, `expandLegalActions(legal)`.

### 2.2 State shape (sketch)
```ts
type Seat = number                         // 0..n-1 clockwise
type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
type Role = 'sheriff' | 'deputy' | 'outlaw' | 'renegade'
interface Card { id: CardId; type: CardType; suit: Suit; rank: number }

interface PlayerState {
  seat: Seat; name: string; characterId: CharacterId | null;   // null only during choose_of_2 setup
  role: Role; life: number; maxLife: number; hand: CardId[]; inPlay: CardId[];
  alive: boolean; isNpc: boolean; npcDifficulty?: 'easy' | 'medium' | 'hard';
}

interface GameState {
  schemaVersion: 1;
  config: GameConfig;                     // players (seat order), characterMode: 'random' | 'choose_of_2'
  rng: RngState;                          // sfc32 state [u32,u32,u32,u32], JSON-safe
  deck: CardId[]; discard: CardId[];      // deck[0] = top; discard top = last element
  players: PlayerState[];
  turn: { seat: Seat; number: number; phase: 'setup' | 'start' | 'draw' | 'play' | 'discard'; bangsPlayed: number };
  stack: Prompt[];                        // pending interactions, top = last element
  winner: null | 'sheriff_team' | 'outlaws' | 'renegade';
  stats: { damageDealt: number; kills: number; cardsPlayed: number }[];  // indexed by seat
}
```
Card data (type/suit/rank) is static in `src/engine/cards/deck.ts` (`getCard(id)`), not stored in the state.
In `choose_of_2` mode, setup pushes one `CHOOSE_CHARACTER` prompt per player (Sheriff first, then clockwise); life
and starting hands are dealt only after every player has chosen (`turn.phase = 'setup'` until then).

### 2.3 Prompt stack (handles nested interactions)
The engine is a state machine driven by a stack of prompts. The top prompt says *who* must act and *which* actions are
legal. Examples:
```ts
type Prompt =
  | { kind: 'CHOOSE_CHARACTER'; seat; options: [CharacterId, CharacterId] } // choose_of_2 setup
  | { kind: 'PLAY'; seat }                                           // free play phase
  | { kind: 'DRAW_CHOICE'; seat; options: ('deck'|'player'|'discard'|'kit')[] } // Jesse / Pedro / Kit
  | { kind: 'KIT_PICK'; seat; cards: CardId[] }                     // keep 2 of 3
  | { kind: 'LUCKY_PICK'; seat; cards: [CardId, CardId]; check: DrawCheck }
  | { kind: 'RESPOND_BANG'; seat; attacker; source: 'bang'|'gatling'; needed: number; got: number }
  | { kind: 'RESPOND_INDIANS'; seat; attacker }
  | { kind: 'DUEL'; seat; opponent; initiator }                     // seat discards a BANG! or is hit by opponent
  | { kind: 'STORE_PICK'; seat; revealed: CardId[]; order: Seat[] } // order = pickers after seat
  | { kind: 'DYING'; seat; killer: Seat | null }
  | { kind: 'DISCARD_EXCESS'; seat; count: number }
  | { kind: 'MULTI_TARGET'; attacker; source: 'gatling'|'indians'; remaining: Seat[] } // driver, no `seat`
```
Driver prompts have no `seat` (`promptActor(prompt) === null`) and are resolved by the engine automatically (e.g.
pushing the next target's `RESPOND_BANG`, skipping targets eliminated meanwhile). A single `advance()` loop resolves
automatic steps until a prompt needs a player. General Store cards live in `STORE_PICK.revealed` until picked; the
last card goes to the last picker without a prompt. There is no `CHOOSE_TARGET_CARD` prompt: Panic! / Cat Balou name
the card in the action's `Target` (see 2.4).

### 2.4 Actions
```ts
type Action =
  | { type: 'PLAY_CARD'; cardId: CardId; asType?: 'bang' | 'missed'; target?: Target } // asType for Calamity
  | { type: 'RESPOND'; cardIds: CardId[] }       // Missed!/BANG!/Beer depending on prompt
  | { type: 'PASS' }                             // take hit / decline / stop dueling
  | { type: 'CHOOSE'; choice: Choice }           // draw option, store pick, kit pick, lucky pick, target card
  | { type: 'ABILITY'; ability: 'sid_ketchum'; cardIds: [CardId, CardId] }
  | { type: 'END_TURN' }
  | { type: 'DISCARD'; cardIds: CardId[] }
type Target = { seat?: Seat; cardId?: CardId; fromHand?: true }
type Choice =
  | { kind: 'character'; characterId: CharacterId }
  | { kind: 'store_card'; cardId: CardId }        /* | draw option, kit pick, lucky pick … in Phase 4 */
```
Panic! / Cat Balou are one atomic action: `target: { seat, fromHand: true }` takes a random hand card (engine RNG),
`target: { seat, cardId }` takes that in-play card. The UI collects player + card client-side before sending.

`getLegalActions` returns **descriptors**, not every concrete action, because card picks would explode
combinatorially ("discard any 3 of these 7"):
```ts
type LegalAction =
  | { type: 'PLAY_CARD'; cardId; targets: Target[] | null }  // null = no target; else pick exactly one
  | { type: 'RESPOND'; cardIds: CardId[]; count: number }    // exactly `count` distinct cards from cardIds
  | { type: 'PASS' } | { type: 'END_TURN' }
  | { type: 'CHOOSE'; choices: Choice[] }
  | { type: 'DISCARD'; cardIds: CardId[]; count: number }
```
A BANG! target always gets a `RESPOND_BANG` prompt, and a player at 0 life always gets `DYING`, even with no usable
card (then `PASS` is the only option): skipping the prompt would reveal that their hand has no Missed!/Beer.

### 2.5 Events (drive the 3D Director and the log)
Events are fine-grained, ordered, and carry everything needed to animate. The engine returns them in order; the
commit layer (server / LocalAdapter) assigns each its `seq` within the commit.
```ts
type GameEvent =
  | { t: 'GAME_STARTED'; seats: SeatPublic[] } | { t: 'ROLE_ASSIGNED'; seat; role } /* private except sheriff */
  | { t: 'CHARACTER_CHOSEN'; seat; characterId }                    /* choose_of_2 setup */
  | { t: 'TURN_STARTED'; seat; turn } | { t: 'PHASE'; seat; phase }
  | { t: 'CARDS_DRAWN'; seat; count; cardIds?: CardId[]; from: 'deck'|'discard'|'player'; fromSeat? } /* ids private */
  | { t: 'CARD_REVEALED'; seat; cardId; reason: 'black_jack' }
  | { t: 'DRAW_CHECK'; seat; reason: 'barrel'|'jourdonnais'|'jail'|'dynamite'; cardIds: CardId[]; chosen: CardId; success: boolean }
  | { t: 'CARD_PLAYED'; seat; cardId; asType?; target? }
  | { t: 'EQUIPPED'; seat; cardId; replaced?: CardId } | { t: 'JAILED'; seat; by }
  | { t: 'SHOT'; from; to; source: 'bang'|'gatling'|'duel'; weapon: CardType | 'colt45' }
  | { t: 'MISSED'; seat; via: 'missed'|'barrel'|'jourdonnais'|'calamity' }
  | { t: 'DUEL_ROUND'; seat; discarded: CardId | null }
  | { t: 'INDIANS_DEFENDED'; seat; cardId } | { t: 'INDIANS_HIT'; seat }
  | { t: 'DAMAGED'; seat; amount; source: Seat | null; cause: 'bang'|'gatling'|'indians'|'duel'|'dynamite' }
  | { t: 'HEALED'; seat; amount; cause: 'beer'|'saloon'|'sid' }
  | { t: 'CARD_STOLEN'; from; to; cardId?: CardId; fromHand: boolean }   /* id private if from hand */
  | { t: 'CARD_DISCARDED'; seat; cardIds: CardId[]; reason }
  | { t: 'DYNAMITE_PASSED'; from; to } | { t: 'DYNAMITE_EXPLODED'; seat }
  | { t: 'JAIL_RESULT'; seat; escaped: boolean }
  | { t: 'STORE_REVEALED'; cardIds } | { t: 'STORE_PICKED'; seat; cardId }
  | { t: 'ABILITY_USED'; seat; ability }
  | { t: 'ELIMINATED'; seat; role; killer: Seat | null }
  | { t: 'REWARD'; seat; kind: 'outlaw_bounty'|'deputy_penalty' }
  | { t: 'DECK_RESHUFFLED'; size }
  | { t: 'GAME_OVER'; winner; roles: Role[] }                      /* indexed by seat */
```

### 2.6 Information hiding
- `toPlayerView(state, seat)`: own hand (full cards), own role, every player's public info (character, life, maxLife,
  hand **count**, in-play cards, alive, role if Sheriff/eliminated/game over), deck count, discard top, turn, the current
  prompt (with only public fields; General Store revealed cards are public), `legalActions` for this seat, winner.
- `redactEvent`: removes `cardIds` from `CARDS_DRAWN` / `CARD_STOLEN(fromHand)` for non-owners (the stealer and the victim
  both know the stolen card), hides `ROLE_ASSIGNED` except own and Sheriff, `KIT_PICK` contents etc.
- The AI receives exactly the same `PlayerView` as a human would.

### 2.7 Determinism
`rng` is stored in state and advanced only by engine code. Same seed + same actions ⇒ same result (T-51). The server
generates the seed with `crypto.randomUUID()` at game creation; it is never sent to clients.

## 3. AI (`src/ai`)
`decide(view: PlayerView, difficulty, rng): Action` — pure, see docs/06. Runs in a Web Worker in solo mode and inline
on the server for online NPC seats (with a strict time budget).

## 4. Client presentation pipeline

### 4.1 GameAdapter
```ts
interface GameUpdate { version: number; events: GameEvent[]; view: PlayerView }
interface GameAdapter {
  readonly mySeat: Seat
  start(): Promise<GameUpdate>                       // initial snapshot (view + recent events for log)
  onUpdate(cb: (u: GameUpdate) => void): () => void
  send(action: Action): Promise<void>                // rejects with IllegalAction / Conflict / Network
  reportTimeout(): Promise<void>                     // online only
  dispose(): void
}
```
The UI and 3D code depend only on this interface → solo and online share 100% of presentation code.

### 4.2 Presented view vs latest view
`useGameStore` keeps a queue of `GameUpdate`s. The **Director** pops an update, plays its events as cinematic
sequences, then sets `presentedView = update.view`. The HUD renders `presentedView`, so results are never spoiled
before the animation. Input is enabled only when the queue is empty and `presentedView.legalActions` is non-empty.
Skip / cinematics "off" = apply updates instantly (still in order).

### 4.3 Client state stores (Zustand)
- `gameStore`: adapter, queue, presentedView, selection state (selected card, hovered target), pending send.
- `settingsStore`: quality, cinematics, speed, audio, language (persisted in localStorage).
- `sessionStore`: user, profile, room.

## 5. Online server flow

### 5.1 `POST /api/games/[id]/action` body `{ action, clientVersion }`
1. Authenticate via Supabase server client (cookie session); get `user.id`.
2. Look up the user's seat in `game_seats` (service role client).
3. Load `games` row → `state`, `version`. If `clientVersion !== version` → 409 with current version (client resyncs).
4. `applyAction(state, seat, action)`; IllegalActionError → 422.
5. **NPC loop:** while game not over and `currentActor` is an NPC seat (or a human seat flagged `afk_takeover`):
   `action = ai.decide(toPlayerView(state, actor), difficulty, rngFor(state))`, apply, append events. Hard cap 500
   iterations; time budget per NPC decision 50 ms (hard AI degrades gracefully).
6. Compute `prompt_deadline = now() + turnTimer` if the next actor is human and timer enabled, else null.
7. Build views for every human seat and redacted events (public row + private rows per recipient where content differs).
8. `rpc('commit_game_action', { expected_version: version, … })`. On `VERSION_CONFLICT` retry once from step 3
   (re-validate legality), else 409.
9. If finished: update `rooms.status`, stats. Respond `{ version }`.

### 5.2 `POST /api/games/[id]/timeout`
Server checks `prompt_deadline < now()` and that the version matches; applies `defaultActionOnTimeout` for the current
actor, increments that seat's consecutive timeout counter (stored in `game_seats.timeouts`); after
`afkTakeoverAfter` timeouts the seat is set to `afk_takeover = true` (NPC medium plays until the human acts again —
any successful human action clears the flag). Then runs the NPC loop and commits like 5.1.

### 5.3 Client sync (OnlineAdapter)
1. On mount: fetch own `player_views` row + last 200 events for the log.
2. Subscribe to realtime `postgres_changes` on `player_views` filtered `game_id=eq.<id>` (RLS limits to own row).
3. On change with `version > lastVersion`: select `game_events` where `game_id = id and version > lastVersion`
   ordered by `version, seq`, merge private over public by `(version, seq)`, push one `GameUpdate`.
4. On reconnect / tab focus: compare version and refetch. Show a "Menyambung ulang…" toast.
5. Timer ring uses the `deadline` field in the view; when it passes, the client calls `/timeout` (jittered 0–1.5 s so
   not everyone fires at once; the server tolerates duplicates via version check).

### 5.4 Rooms API (route handlers)
- `POST /api/rooms` → create room + host slot, returns code.
- `POST /api/rooms/join { code }` → validate status lobby & capacity, insert `room_players`.
- `POST /api/rooms/[id]/seat` → host: add/remove NPC, kick; player: ready toggle, leave.
- `PATCH /api/rooms/[id]/settings` → host only.
- `POST /api/rooms/[id]/start` → host only: assigns seats (shuffle humans + NPCs), `createGame`, insert `games`,
  `game_seats`, initial views/events, set room status `in_game`.
- `POST /api/rooms/[id]/rematch` → new game, same seats.
Lobby presence uses a Supabase Realtime **presence** channel `room:<code>`; slots list via `postgres_changes` on
`room_players`.

## 6. Security checklist
- RLS on every table; clients can only SELECT their allowed rows. All writes go through route handlers using the
  secret key, after checking `auth.uid()` membership/host rights.
- Validate request bodies with **zod**. Rate-limit action endpoints per user (simple in-memory token bucket per instance
  is acceptable for a private game).
- `SITE_PASSWORD` gate implemented in `src/proxy.ts` (Next.js 16 renamed `middleware.ts` to `proxy.ts`; cookie after
  correct password) — skip for `/api/*` health.
- `robots.txt` disallow all + `<meta name="robots" content="noindex">`.

## 7. Performance notes
- 3D canvas mounted once per game; HUD in HTML/CSS layered over the canvas (cheaper and crisper than 3D text).
- Assets loaded through a manifest with progressive loading: placeholders render immediately, real GLBs swap in.
- AI in a Web Worker (solo) so animations never stutter.
