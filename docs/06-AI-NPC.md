# 06 — NPC AI

## 1. Contract
```ts
createMemory(view: PlayerView): AiMemory
observe(memory: AiMemory, event: GameEvent /* already redacted for this NPC */): AiMemory   // pure, returns a new one
decide(view, memory, difficulty: 'easy' | 'medium' | 'hard', rng: RngState, opts?: AiOptions): Action
decideSafe(view, memory, difficulty, rng, opts?, onProblem?): Action   // what every host calls
interface AiOptions { samples?; candidates?; horizon?; now?: () => number; budgetMs?: number }  // hard only
```
- Input is **only** the NPC's own `PlayerView` (+ its private memory built from the events it was shown, see 3).
  No access to `GameState`. NPCs never cheat.
- Must always return an action contained in `view.legalActions`. `decideSafe` validates with the engine's
  `matchLegal(view.legalActions, action)` and, if the brain throws or picks something illegal, reports it through
  `onProblem` and plays `fallbackAction(view)` (= the engine's timeout policy, `defaultActionFromLegal`).
- Pure and deterministic given (view, memory, rng, opts). The RNG is the engine's seeded `RngState`, advanced in place.
- **Budget:** the hard bot's work is bounded by counts (`samples`, `candidates`, `horizon`; defaults 8 / 5 / 40), so
  simulations are reproducible. `src/ai` cannot read a clock (Golden rule 2); an online host may inject
  `now` + `budgetMs = 50` as an extra wall-clock guard (at least one sample always runs).
- Solo: runs in a Web Worker (Phase 6). Online: inline on the server.

## 2. Shared building blocks (`src/ai/lib`)
- `cardValue(view, cardId)` — how useful a card is to keep (Missed! high when low life, Beer high when hurt and useless
  with 2 alive, weapons by range gain, duplicates of equipped blue cards low).
- `hostility(view, memory, seat)` in [-1, 1] — how much I want that player weakened, from my role, public roles and
  suspicion (table in §3). Medium's attack and targeting scores are built on it.
- Distances: the engine's `effectiveDistance` / `weaponRange` accept a `PlayerView` directly (structural type), so the
  AI never re-implements the distance rules.
- `characterStrength(id)` — ranking used in the choose_of_2 variant.

## 3. Role inference (medium/hard)
Each NPC keeps `memory.suspicion[seat]` in [-1, 1] = estimated probability-weighted "is an enemy of the Sheriff", and
`memory.knownRoles` (own role, the Sheriff, eliminated players; known roles pin suspicion to ±1). Implemented in
`src/ai/memory.ts`: a targeted BANG!/Duel/Panic!/Cat Balou/Jail on the Sheriff adds +0.6; on another player it adds
−0.35 × that player's suspicion; removing Jail/Dynamite from someone counts as the opposite (helping).
Role counting (`lib/hostility.ts` `effectiveSuspicion`) overrides behavior when it is conclusive: the role table minus
every known role is the pool of the unknown players; if that pool holds only enemies of the Sheriff (or none), every
unknown player's suspicion is certain. Example: once both Outlaws are dead, the last unknown is the Renegade even if he
only ever shot Outlaws; the only Deputy at a 5-player table knows all unknowns are enemies.
Updated from public events:
- Attacking the Sheriff (BANG!/Duel/Panic!/Cat Balou/Jail on Sheriff) → strong +.
- Attacking a player who attacked the Sheriff → −.
- Healing the Sheriff impossible directly, but Saloon/General Store gifts are neutral.
- Revealed roles on death update team counts (e.g., once all Outlaws are dead, any remaining non-Sheriff aggressor
  must be the Renegade).
Role-based target preferences:
| My role | Wants dead | Protects |
|---|---|---|
| Sheriff | highest suspicion | likely deputies (low suspicion) |
| Deputy | highest suspicion; Renegade late | Sheriff |
| Outlaw | Sheriff first, then deputies (low suspicion) | other likely outlaws |
| Renegade | keeps Sheriff alive while others remain; balances teams; kills Sheriff when 1v1 | Sheriff (early) |

## 4. Difficulty levels
### Easy
- Plays a random legal non-wasteful card ~60% of the time, otherwise ends turn.
- Targets randomly among legal targets (Sheriff team bias: a Deputy never targets the Sheriff; the Renegade only in the
  final 1-vs-1, otherwise games stall with an easy Renegade facing the Sheriff alone).
- Always uses Missed! if it has one; plays Beer only when life ≤ 1; discards random excess.

### Medium (heuristic, rule-based)
Turn plan in priority order:
1. Survive: if dying → Beer/Sid ability. If life low and Beer available and not at max → Beer.
2. Gain cards: Stagecoach, Wells Fargo, Panic! (steal best card), General Store.
3. Equip: better weapon if it brings an enemy into range; Mustang/Scope/Barrel always; Dynamite when hand is strong
   and players to the left are enemies (weighted); Jail on the most suspected enemy (never Sheriff).
4. Attack: BANG! the highest-priority enemy in range (prefer low life, prefer killable); Duel if I hold more BANG! than
   the target likely does (estimate by hand size); Gatling/Indians! when enemies outnumber friends among targets.
5. Keep Missed! and one Beer for defense; discard least valuable cards.
Responses: use Missed!/Barrel automatically; in Duel keep discarding BANG! while value of winning > cost.

### Hard
- Medium heuristics + **determinized lookahead** at its own PLAY prompt: sample K plausible hidden worlds consistent
  with the view (`determinize`: unknown hands and deck order from a shuffle of the unseen cards; unknown roles drawn
  from the remaining role pool weighted by suspicion), try medium's top `candidates` actions (+ END_TURN) in every
  world, let all seats play on with the medium policy until this NPC's turn ends (or `horizon` steps), score with a
  role-aware utility (`utility.ts`), pick the best average (ties keep medium's order).
- Every other prompt (responses, dying, choices) uses medium: the view only shows the top of the prompt stack, so
  those situations cannot be rebuilt faithfully. The important decisions happen in the play phase.
- Utility: team win probability proxy = Σ(friendly life & cards) − Σ(enemy life & cards) + bonuses for kills of enemies,
  heavy penalty for killing teammates/Sheriff (unless Outlaw/endgame Renegade).
- Bluff awareness: Renegade hides by attacking Outlaws early; Deputies avoid attacking uncertain players at low info.
- Falls back to medium when the budget is exhausted.

## 5. Choices & prompts
| Prompt | Policy |
|---|---|
| DRAW_CHOICE | Jesse: steal from the enemy with most cards; Pedro: take the discard top if it's valuable |
| KIT_PICK | return the least valuable of the 3 |
| STORE_PICK | highest `cardValue` |
| Panic! / Cat Balou target (in the PLAY_CARD `Target`) | best in-play card of an enemy (weapon > barrel > mustang > scope), Jail/Dynamite off an ally when that is the goal (never yourself, R-13), else a random hand card |
| DISCARD_EXCESS | discard lowest value |
| DYING | heal if possible (Beer, Sid Ketchum ability) |

Lucky Duke needs no policy: the engine always keeps the favorable draw! card for him (R-23).

## 6. Simulation harness (`scripts/sim.ts`, `pnpm sim`)
```
pnpm sim -- --games 10000 --players 4-7 --difficulty mixed --seed sim --workers 6 --json report.json
pnpm sim -- --games 1 --seed sim-42 --exact      # replay one failing game
           [--hard-samples 8 --hard-candidates 5 --hard-horizon 40]
```
- One game = `simulateGame()` in `src/ai/simulate.ts` (pure, also used by the Vitest smoke test): all-NPC seats, each
  bot deciding through `decideSafe` from its own view and the redacted events it was shown, exactly like a host.
- Asserts every step: chosen action ∈ legal actions (any fallback counts as an AI problem), the engine accepts it,
  `checkInvariants` holds (80 cards conserved across deck/discard/hands/in play/store/Kit; life ≤ max; dead players
  hold no cards; exactly one Sheriff; stack consistent), game terminates within 1000 turns.
- Reports win rates per role, a difficulty × role table, a role-normalized score per difficulty (mean over roles of
  "difficulty win rate − overall role win rate"), average length, and failing seeds. Exit code 1 on any failure.
- Parallel through Node `worker_threads` (script only); results are reordered by job, so the report is deterministic.
- Acceptance: 10,000 games without invariant violations; Hard beats Medium beats Easy in mixed tables (role-normalized).
