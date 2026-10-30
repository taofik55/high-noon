# 06 — NPC AI

## 1. Contract
```ts
decide(view: PlayerView, difficulty: 'easy' | 'medium' | 'hard', rng: Rng, budgetMs?: number): Action
```
- Input is **only** the NPC's own `PlayerView` (+ its private memory object derived from past public events, see 3).
  No access to `GameState`. NPCs never cheat.
- Must always return an action contained in `view.legalActions`. A wrapper validates and falls back to
  `defaultActionOnTimeout` semantics if the brain returns something illegal (and logs it in dev).
- Pure and deterministic given (view, memory, rng). Solo: runs in a Web Worker. Online: runs inline on the server with
  `budgetMs = 50`.

## 2. Shared building blocks (`src/ai/lib`)
- `evaluateCardValue(card, context)` — how useful a card is to keep (Missed! high when low life, Beer high when hurt,
  weapons by range relative to targets, etc.).
- `threatOf(seat)` — how dangerous a player is to me (range to me, hand size, weapon, known hostility).
- `canKill(target)` — whether my available BANG!/Duel/Gatling/Indians! could finish them this turn.
- `distanceTable(view)` — effective distance from each player to each other (public info).

## 3. Role inference (medium/hard)
Each NPC keeps `memory.suspicion[seat]` in [-1, 1] = estimated probability-weighted "is an enemy of the Sheriff".
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
- Targets randomly among legal targets (Sheriff team bias: never target Sheriff unless Outlaw).
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
- Medium heuristics + **determinized lookahead**: sample K (e.g. 8–24, limited by `budgetMs`) plausible hidden worlds
  consistent with the view (unknown hand contents drawn from the unseen card pool; unknown roles drawn from the role
  posterior from 3), simulate the next 1–2 own decisions + opponents' likely responses with the medium policy, score
  outcomes with a role-aware utility, pick the action with best average.
- Utility: team win probability proxy = Σ(friendly life & cards) − Σ(enemy life & cards) + bonuses for kills of enemies,
  heavy penalty for killing teammates/Sheriff (unless Outlaw/endgame Renegade).
- Bluff awareness: Renegade hides by attacking Outlaws early; Deputies avoid attacking uncertain players at low info.
- Falls back to medium when the budget is exhausted.

## 5. Choices & prompts
| Prompt | Policy |
|---|---|
| DRAW_CHOICE (Jesse) | steal from the enemy with most cards; Pedro takes discard top if it's valuable; Kit keeps 2 best |
| STORE_PICK | highest `evaluateCardValue` |
| LUCKY_PICK | the favorable card for the current check |
| CHOOSE_TARGET_CARD | take/discard best in-play card of an enemy (weapon > barrel > mustang > scope), remove Jail/Dynamite from self/allies when that is the goal, else random hand |
| DISCARD_EXCESS | discard lowest value |
| DYING | heal if possible |

## 6. Simulation harness (`scripts/sim.ts`, `pnpm sim`)
- Runs N full games with all-NPC seats, random player counts and difficulties, seeded.
- Asserts every step: chosen action ∈ legal actions, invariants hold (80 cards conserved across deck/discard/hands/in
  play/store; life ≤ max; dead players have no cards; exactly one Sheriff; stack consistent), game terminates within
  1000 turns.
- Reports win rates per role/difficulty, average game length, crash seeds for reproduction.
- Acceptance: 10,000 games without invariant violations; Hard beats Medium beats Easy in mixed tables (role-normalized).
