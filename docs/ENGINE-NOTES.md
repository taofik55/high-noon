# Engine notes — interpretations and design choices

Everything below is implemented in `src/engine` and covered by tests in `tests/engine`. Rulings marked R-x live in
`docs/02-GAME-RULES.md`; this file collects the places where the engine had to choose an interpretation or a shape that
the printed rules or the original docs left open. Read it before changing engine behavior.

## Rule interpretations

| Topic | Engine behavior | Where |
|---|---|---|
| Card suits/ranks (R-1) | Official list as best known (20 per suit), marked `TODO(verify)`. Tests never depend on it. | `cards/deck.ts` |
| BANG! with no Missed! in hand | The target is still prompted (only `PASS`), otherwise the skipped prompt would leak the hand. Same for `DYING` without Beer. | `bangResponse.ts`, `damage.ts` |
| Barrel success | No prompt when Barrel/Jourdonnais checks already cancel the hit (Barrels are public, nothing leaks). Partial success raises `got`, so Barrel + Missed! beats Slab (R-10). | `bangResponse.ts` |
| Panic! / Cat Balou | No follow-up prompt: the action's `Target` names `{ seat, fromHand: true }` (random hand card) or `{ seat, cardId }`. | `cards/takeCard.ts` |
| Saloon (R-30) | Playable at any time, even if nobody is wounded and with 2 players alive. | `cards/simple.ts` |
| General Store (R-31) | Reveals what deck + discard can give (the played card itself may be reshuffled back in); last pickers may get nothing. Last card is given without a prompt. | `cards/generalStore.ts` |
| Same weapon twice (R-32) | Not playable: the duplicate-name rule covers the weapon you already hold. | `cards/equip.ts` |
| Empty draw! (R-33) | No card to reveal ⇒ the check fails (Dynamite does not explode). Jail/Dynamite are discarded only after their own check. | `drawCheck.ts`, `startOfTurn.ts` |
| Start of turn | Dynamite, then Jail. Each check consumes its card, so re-entering the `start` phase after a `DYING` prompt never checks twice. | `startOfTurn.ts` |
| Dynamite with nowhere to go | Unreachable with one Dynamite; it is discarded to keep the loop finite (R-4 guard). | `startOfTurn.ts` |
| El Gringo (R-20) | Draws only if he is still at 1+ life after the hit; nothing if the hit put him at 0 or below, even if a Beer then saves him. | `damage.ts` |
| Lucky Duke (R-23) | Automatic favorable pick (no `LUCKY_PICK` prompt): every check has a dominant choice. | `drawCheck.ts` |
| Sid Ketchum (R-25) | Available whenever he is the actor (play, responses, Duel, dying, discard phase), with ≥ 2 cards and below max life. The discard-phase count is recomputed after use. He cannot interrupt another player's prompt. | `legal.ts`, `apply.ts` |
| Suzy Lafayette (R-27) | Checked at every `advance()` step, i.e. after each action and each automatic step, in or out of her turn; not during setup or once dead. | `turn.ts` |
| Kit Carlson (R-22) | Fewer than 3 cards available ⇒ he keeps them all without a prompt. | `drawPhase.ts` |
| Jesse Jones / Pedro Ramirez | No prompt when the alternative is impossible (nobody else has cards / discard empty). | `drawPhase.ts` |
| Elimination order (R-15) | Reveal role → Vulture Sam pickup (or discard) → win check (game over cancels the rest) → reward/penalty. | `damage.ts` |
| Character choice (`choose_of_2`) | Sequential: Sheriff first, then clockwise; life and hands are dealt after everyone has chosen. | `createGame.ts` |

## Shapes that differ from the first draft of docs/03

- `getLegalActions` returns descriptors (`count` of `cardIds`, list of `targets`), not every concrete action.
- No `CHOOSE_TARGET_CARD` and no `LUCKY_PICK` prompts; `DRAW_CHOICE` stores only the seat (options are derived).
- Driver prompts (`MULTI_TARGET`) have no `seat`; use `promptActor()`.
- Card data is static (`getCard(id)`); states and views carry ids only.
- Event `seq` is assigned by the commit layer, not by the engine. `CARDS_INHERITED` was added for Vulture Sam.
- `stats` and `GAME_OVER.roles` are arrays indexed by seat.
- `PlayerView.discard` is the whole pile (public), not just the top card.

## Timeouts

`defaultActionOnTimeout` defends instead of taking the hit (Missed! when shot, BANG! against Indians!, Beer when
dying); otherwise `END_TURN`, `PASS` in a Duel, the first offered choice, and the most recently drawn cards for the
discard phase. It is always legal (checked at every step of the 500-game property test).

## Testing helpers

- `tests/engine/helpers/scenario.ts` builds exact states from the real 80 cards. The default character is Willy the
  Kid (his ability only lifts the BANG! limit); tests about the limit or any ability pick characters explicitly.
- `tests/engine/helpers/invariants.ts` checks card conservation (including cards held in `STORE_PICK`/`KIT_PICK`),
  life bounds, dead players holding nothing, one Sheriff, and stack consistency.
