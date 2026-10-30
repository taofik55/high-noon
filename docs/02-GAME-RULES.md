# 02 — Game Rules Specification (Bang! base game)

This is the authoritative rules spec for the engine. Where the printed rules are ambiguous, a **Ruling (R-x)** fixes
the behavior so the engine is deterministic. Every ruling and every **Test (T-x)** must have a Vitest case.

---

## 1. Components

### 1.1 Roles by player count
| Players | Sheriff | Deputy | Outlaw | Renegade |
|---|---|---|---|---|
| 4 | 1 | 0 | 2 | 1 |
| 5 | 1 | 1 | 2 | 1 |
| 6 | 1 | 1 | 3 | 1 |
| 7 | 1 | 2 | 3 | 1 |

### 1.2 Characters (16) — max life shown; Sheriff gets +1
| id | Name | Life | Ability |
|---|---|---|---|
| `bart_cassidy` | Bart Cassidy | 4 | Each time he loses a life point, he draws a card from the deck. |
| `black_jack` | Black Jack | 4 | In his draw phase he shows the 2nd card drawn; if it is Hearts or Diamonds he draws 1 more card (not shown). |
| `calamity_janet` | Calamity Janet | 4 | May use BANG! as Missed! and Missed! as BANG!. |
| `el_gringo` | El Gringo | 3 | Each time he loses a life point due to a card played by another player, he draws a random card from that player's hand (one per life point). |
| `jesse_jones` | Jesse Jones | 4 | In his draw phase he may draw the first card from the hand of a player of his choice (random), the second from the deck. |
| `jourdonnais` | Jourdonnais | 4 | Is considered to always have a Barrel in play. |
| `kit_carlson` | Kit Carlson | 4 | In his draw phase he looks at the top 3 cards of the deck, keeps 2, puts the other back on top. |
| `lucky_duke` | Lucky Duke | 4 | Each time he must "draw!", he flips the top 2 cards and chooses which one applies. Both are discarded. |
| `paul_regret` | Paul Regret | 3 | Is considered to always have a Mustang in play. |
| `pedro_ramirez` | Pedro Ramirez | 4 | In his draw phase he may draw the first card from the top of the discard pile, the second from the deck. |
| `rose_doolan` | Rose Doolan | 4 | Is considered to always have a Scope in play. |
| `sid_ketchum` | Sid Ketchum | 4 | At any time he may discard 2 cards from his hand to regain 1 life point (repeatable). |
| `slab_the_killer` | Slab the Killer | 4 | Players trying to cancel his BANG! cards need 2 Missed! effects. |
| `suzy_lafayette` | Suzy Lafayette | 4 | As soon as she has no cards in hand, she draws a card from the deck. |
| `vulture_sam` | Vulture Sam | 4 | Whenever another character is eliminated, he takes all cards from that player's hand and in play into his hand. |
| `willy_the_kid` | Willy the Kid | 4 | Can play any number of BANG! cards in his turn. |

### 1.3 Playing cards (80)
**Brown (instant) cards — 63**
| type | Name | Count | Effect summary |
|---|---|---|---|
| `bang` | BANG! | 25 | Target 1 player within weapon range loses 1 life unless they cancel. Limit 1 per turn. |
| `missed` | Missed! | 12 | Cancel one BANG! effect aimed at you. Only playable as a response. |
| `beer` | Beer | 6 | Regain 1 life (not above max). No effect with only 2 players alive. |
| `panic` | Panic! | 4 | Take 1 card (random from hand, or a chosen in-play card) from a player at distance 1. |
| `cat_balou` | Cat Balou | 4 | Force any player (any distance) to discard 1 card (random from hand, or a chosen in-play card). |
| `stagecoach` | Stagecoach | 2 | Draw 2 cards. |
| `wells_fargo` | Wells Fargo | 1 | Draw 3 cards. |
| `gatling` | Gatling | 1 | A BANG! to every other player (ignores range; does not count toward BANG! limit). |
| `duel` | Duel | 3 | Challenge any player; alternate discarding BANG! starting with the target; first who doesn't loses 1 life. |
| `indians` | Indians! | 2 | Every other player discards a BANG! or loses 1 life. |
| `general_store` | General Store | 2 | Reveal 1 card per living player; starting with you, clockwise, each takes one. |
| `saloon` | Saloon | 1 | All living players regain 1 life. |

**Blue (in-play) cards — 17**
| type | Name | Count | Effect |
|---|---|---|---|
| `barrel` | Barrel | 2 | When targeted by a BANG! effect, "draw!": Hearts → counts as one Missed!. |
| `scope` | Scope | 1 | You see all other players at distance −1. |
| `mustang` | Mustang | 2 | Other players see you at distance +1. |
| `jail` | Jail | 3 | Play on another player (never the Sheriff). At their turn start, "draw!": Hearts → discard Jail, play normally; otherwise discard Jail and skip the turn. |
| `dynamite` | Dynamite | 1 | Play in front of yourself. At your turn start, "draw!": Spades 2–9 → explodes, you lose 3 life, discard it; otherwise pass it to the next living player on your left. |
| `volcanic` | Volcanic | 2 | Weapon, range 1, unlimited BANG! per turn. |
| `schofield` | Schofield | 3 | Weapon, range 2. |
| `remington` | Remington | 1 | Weapon, range 3. |
| `rev_carabine` | Rev. Carabine | 1 | Weapon, range 4. |
| `winchester` | Winchester | 1 | Weapon, range 5. |

Default weapon when none is in play: **Colt .45, range 1** (not a card).

### 1.4 Suits and ranks
Every card has a suit (♥ ♦ ♣ ♠) and rank (2–10, J=11, Q=12, K=13, A=14). Suit/rank matter only for "draw!" checks
(Barrel, Jail, Dynamite) and Black Jack. `src/engine/cards/deck.ts` must define all 80 cards with suit and rank.
**Ruling R-1:** use the official card list if you can confirm it; otherwise generate a placeholder assignment with
roughly 20 cards per suit and mark the file `// TODO(verify): suits/ranks vs physical deck`. The owner will verify
against their physical deck. Tests must not depend on a specific card's printed suit — they construct decks explicitly.

---

## 2. Setup
1. Choose N = 4–7 players. Build role deck per 1.1, shuffle, deal 1 role per player. Sheriff's role is revealed.
2. Character assignment: random 1 per player (default), or "choose 1 of 2" variant (setting).
3. Each player's `maxLife` = character life (+1 if Sheriff). `life = maxLife`.
4. Seats are in clockwise order. Shuffle the 80 cards. Each player draws cards equal to their life.
5. The Sheriff takes the first turn.

## 3. Distance and range
- **Seat distance** between A and B = minimum number of steps clockwise or counter-clockwise, counting only living
  players.
- **Effective distance A→B** = seat distance + (B's Mustang ? 1 : 0) + (B is Paul Regret ? 1 : 0)
  − (A's Scope ? 1 : 0) − (A is Rose Doolan ? 1 : 0); minimum 1.
- **R-2:** Character built-in effects stack with the real card (Paul Regret + Mustang = +2; Rose Doolan + Scope = −2).
- BANG! (and Calamity's Missed!-as-BANG!) requires effective distance ≤ weapon range.
- Panic! requires effective distance ≤ 1 (weapon ignored).
- Cat Balou, Duel, Jail: any distance.

## 4. Turn structure
### 4.1 Start of turn
1. If the active player has **Dynamite**, resolve it first (draw!). If it explodes: lose 3 life (resolve damage and
   possible death; **R-3:** no kill reward or penalty from Dynamite). If not, pass it to the next living player on the left
   (**R-4:** skip players that already have a Dynamite — impossible in base game but keep the guard).
2. If still alive and has **Jail**, draw!: Hearts → discard Jail, continue; else discard Jail and the turn ends immediately
   (no draw, no play, no discard phase).
3. **R-5:** If the active player dies during step 1, their turn ends and passes to the next living player.

### 4.2 Draw phase (phase 1)
Draw 2 cards from the deck, unless a character modifies it (Black Jack, Jesse Jones, Kit Carlson, Pedro Ramirez).

### 4.3 Play phase (phase 2)
Play any number of cards, in any order, subject to:
- Max 1 BANG! card per turn (Volcanic or Willy the Kid: unlimited). Gatling, Duel, Indians! do not count.
- Max 1 weapon in play; playing a new weapon discards the old one.
- No two blue cards with the same name in front of the same player (applies to Jail on the target too).
  **R-32:** this also means the weapon you already have in play cannot be played again (it would replace itself).
- Jail cannot target the Sheriff. Dynamite goes in front of yourself.
- Beer: no effect and **not playable** when only 2 players are alive (R-6). Beer cannot be played if already at max life
  (R-7, prevents pointless plays; the UI disables it).
- Sid Ketchum ability available any time (also out of turn).
The player ends the play phase with `END_TURN`.

### 4.4 Discard phase (phase 3)
If hand size > current life, discard down to current life (player chooses which). Then the next living player
clockwise starts their turn.

### 4.5 Deck exhaustion
When a card must be drawn from an empty deck, shuffle the whole discard pile into a new deck (**R-8**).
If both are empty, the draw is skipped (extremely rare; must not crash).

## 5. "draw!" checks
Reveal the top card of the deck, apply the check, discard the revealed card. Lucky Duke reveals 2 and chooses 1
(both discarded). Check conditions:
- Barrel / Jourdonnais: Hearts → success.
- Jail: Hearts → escape.
- Dynamite: Spades with rank 2–9 → explodes.
**R-9:** Barrel checks are performed automatically (it has no downside) before asking for Missed!. Jourdonnais with a real
Barrel performs up to two checks (ability first, then card), stopping as soon as enough Missed! effects are reached.
If the checks already cancel the hit, the target is not prompted (the Barrel is public, so nothing leaks).
**R-33:** If no card can be revealed (deck and discard both empty), the check fails: Barrel gives no Missed!, Jail
keeps you in (turn skipped), Dynamite does not explode and passes on. The card being checked (Jail, Dynamite) is
discarded only after the draw!, so it can never be reshuffled into its own check.

## 6. Card effect resolution details
### 6.1 BANG!
Target loses 1 life unless they produce enough Missed! effects (1, or 2 vs Slab the Killer). Missed! effects come from:
Barrel success, Jourdonnais success, Missed! card, Calamity Janet's BANG!-as-Missed!. Against Slab, one Barrel success
+ one Missed! card is valid (**R-10**). If the target cannot or chooses not to cancel, `PASS` = take the hit.
### 6.2 Gatling
Treated as a BANG! against each other living player, resolved one target at a time clockwise starting from the player
on the attacker's left (**R-11**). Barrel/Missed! apply. **R-12:** Slab the Killer's ability applies only to BANG!
cards; Gatling is not a BANG! card, so his Gatling needs only 1 Missed! per target.
### 6.3 Indians!
Each other living player, clockwise from attacker's left, discards a BANG! (Calamity may discard Missed!) or loses 1
life. Missed!/Barrel cannot be used.
### 6.4 Duel
Target first, then alternating, each discards a BANG! (Calamity: Missed! too). First who passes loses 1 life. The source
of that damage is the opponent (for El Gringo and kill credit). The player who played Duel can lose it.
### 6.5 Panic! / Cat Balou
Choose target player, then either "random card from hand" or a specific in-play card (including Jail or Dynamite in
front of them). Target must have at least one card (hand or in play). Cannot target yourself (**R-13**).
### 6.6 General Store
Reveal K cards (K = living players). Starting with the player who played it, clockwise, each living player picks 1.
The last player gets the last card automatically.
**R-31:** If deck + discard hold fewer than K cards (R-8 reshuffle included, which can bring the General Store card
itself back), reveal what is available; pickers at the end of the order get nothing.
### 6.7 Beer & Saloon
+1 life up to max. Saloon heals everyone alive including the player who played it.
**R-30:** Saloon is playable even if nobody is wounded and with only 2 players alive (R-6/R-7 restrict Beer only).
### 6.8 Stagecoach / Wells Fargo
Draw 2 / 3.

## 7. Damage, dying, elimination
1. When a player's life reaches 0 (or below — damage beyond 0 is clamped, see R-14), they enter **dying**: they may play
   Beer (if more than 2 players alive) and/or use Sid Ketchum's ability until life ≥ 1, or `PASS`.
   **R-14:** with multi-point damage (Dynamite: 3) life may go negative internally; the player needs enough heals to
   reach 1. Display clamps at 0.
2. If still ≤ 0 → eliminated: reveal role; Vulture Sam (if alive and not the victim) takes all their hand and in-play
   cards, else all are discarded.
3. **Kill credit (killer)** = the player whose card caused the final damage (BANG!/Gatling/Indians!: the player who
   played it; Duel: the opponent; Dynamite: none).
4. **Rewards / penalties:** killer eliminates an Outlaw → killer draws 3 cards (any role, even an Outlaw).
   Sheriff eliminates a Deputy → Sheriff discards all cards in hand and in play.
   **R-15:** Vulture Sam takes cards before rewards are drawn. If Sheriff is Vulture Sam and kills a Deputy, he takes the
   cards then discards everything (penalty applies after pickup).
5. Check win conditions immediately after each elimination. If met, the game ends at once (remaining effects cancel).
6. **R-16:** If the active player is eliminated during their own turn (Dynamite, Duel), the turn ends immediately.
7. Effects with multiple targets (Gatling, Indians!) continue with remaining living targets after an elimination unless
   the game ended.

## 8. Win conditions
- **Sheriff team** (Sheriff + Deputies) wins when all Outlaws and the Renegade are eliminated (Sheriff alive).
- **Outlaws** win when the Sheriff is eliminated, unless the Renegade is the only player left alive. Dead Outlaws
  also win.
- **Renegade** wins only if he is the last player alive (Sheriff eliminated with only the Renegade remaining).
- Dead Deputies win with the Sheriff.

## 9. Character timing details
| Ruling | Detail |
|---|---|
| R-17 Bart Cassidy | Draws 1 card per life point lost, any source including Dynamite. The draw happens right after the damage and **before** the dying check, so a drawn Beer can save him. |
| R-18 Black Jack | Second drawn card revealed (public event). If ♥/♦, draw 1 more. Works even when the deck reshuffles. |
| R-19 Calamity Janet | A Missed! played as BANG! counts toward the 1-BANG!-per-turn limit and obeys range. |
| R-20 El Gringo | Per life point lost from a card played by another living player, draw 1 random card from that player's hand if any. Not for Dynamite. Applies during Duel/Indians!/Gatling. If he is eliminated by the hit, no draw. |
| R-21 Jesse Jones | Choice is optional: target any other player with ≥1 card in hand, or draw normally. |
| R-22 Kit Carlson | Looks at 3 (or fewer if deck + discard is smaller), keeps 2, returns 1 to the top of the deck. |
| R-23 Lucky Duke | Applies to every draw! (Barrel, Jail, Dynamite, Jourdonnais). He chooses; the AI/timeout picks the favorable one. |
| R-24 Pedro Ramirez | Optional; only if discard pile is non-empty. |
| R-25 Sid Ketchum | Can be used during dying and in response windows. Requires 2 cards in hand. |
| R-26 Slab the Killer | Targets need 2 Missed! effects against his BANG! cards. Not for Gatling (R-12), Duel or Indians!. |
| R-27 Suzy Lafayette | Whenever her hand becomes empty (any time, in or out of her turn), she draws 1 after the current effect step resolves. Not while she is eliminated. |
| R-28 Vulture Sam | Takes cards of every eliminated player (except himself). Happens before rewards (R-15). |
| R-29 Willy the Kid | Unlimited BANG! cards. |

---

## 10. Test catalogue (minimum)
Each line becomes at least one Vitest test (`tests/engine/*.test.ts`, test name prefixed with the ID).

**Setup & flow**
- T-1 Roles distribution for 4/5/6/7 players matches 1.1.
- T-2 Sheriff maxLife = character life + 1; starting hand = life.
- T-3 Sheriff takes first turn; turns go clockwise skipping dead players.
- T-4 Draw phase draws 2; discard phase forces hand ≤ life.
- T-5 Deck reshuffles discard when empty (R-8); empty deck + empty discard does not crash.

**Distance & range**
- T-6 Seat distance in a 7-player circle; recalculates after eliminations.
- T-7 Mustang +1, Scope −1, Paul Regret/Rose Doolan stack with cards (R-2), minimum distance 1.
- T-8 BANG! illegal beyond range; legal after equipping a longer weapon.
- T-9 Panic! only at effective distance 1 regardless of weapon.

**Brown cards**
- T-10 Only one BANG! per turn; Volcanic and Willy the Kid unlimited.
- T-11 Missed! cancels BANG!; cannot be played outside a response.
- T-12 Beer heals 1, capped at max; disabled with 2 players alive (R-6) and at max life (R-7).
- T-13 Panic!/Cat Balou: random from hand or chosen in-play card; can remove Jail/Dynamite; illegal on empty player and self.
- T-14 Stagecoach draws 2, Wells Fargo draws 3.
- T-15 Gatling hits all others in clockwise order, doesn't count as BANG!; Slab's Gatling needs only 1 Missed! (R-12).
- T-16 Indians!: discard BANG! or lose 1; Missed!/Barrel not usable; Calamity may discard Missed!.
- T-17 Duel alternates starting with target; initiator can lose; damage source is the opponent.
- T-18 General Store reveals K = alive players, pick order starts with the player, clockwise.
- T-19 Saloon heals all living, capped.

**Blue cards**
- T-20 Barrel on ♥ cancels, otherwise must still respond; auto-check before prompt (R-9).
- T-21 Only one weapon; replacing discards old. No duplicate blue card names in front of a player.
- T-22 Jail: illegal on Sheriff; ♥ escapes and plays; otherwise skips turn; discarded either way.
- T-23 Dynamite: explodes on ♠2–9 for 3 damage; otherwise passes left to next living player; resolved before Jail.
- T-24 Dynamite kill grants no reward/penalty (R-3); active player dying from Dynamite ends turn (R-5, R-16).

**Death & win**
- T-25 Dying player may Beer/Sid-heal to survive; with 2 alive Beer is not allowed.
- T-26 Multi-point damage to negative requires enough heals (R-14).
- T-27 Killing an Outlaw draws 3 for the killer; Sheriff killing Deputy discards everything.
- T-28 Vulture Sam takes all cards of eliminated players before rewards (R-15, R-28).
- T-29 Sheriff team wins when all Outlaws and Renegade are dead.
- T-30 Outlaws win when Sheriff dies with any non-Renegade player alive (including only dead Outlaws).
- T-31 Renegade wins only as sole survivor.
- T-32 Game ends immediately mid-Gatling/Indians! when a win condition is met.

**Characters** (one or more tests each)
- T-33 Bart Cassidy (incl. 3 cards from Dynamite, R-17)
- T-34 Black Jack reveal & extra draw (R-18)
- T-35 Calamity Janet both directions, counts toward limit (R-19)
- T-36 El Gringo per point, none from Dynamite, none if attacker's hand empty (R-20)
- T-37 Jesse Jones optional steal (R-21)
- T-38 Jourdonnais built-in barrel + real barrel = two checks (R-9)
- T-39 Kit Carlson keeps 2 returns 1 to top (R-22)
- T-40 Lucky Duke chooses among 2 on every draw! (R-23)
- T-41 Paul Regret +1 distance (R-2)
- T-42 Pedro Ramirez discard-pile draw optional (R-24)
- T-43 Rose Doolan −1 distance (R-2)
- T-44 Sid Ketchum discard 2 → +1 life, during dying (R-25)
- T-45 Slab the Killer 2 Missed! needed; Barrel + Missed! valid (R-10)
- T-46 Suzy Lafayette draws when hand empty, even out of turn (R-27)
- T-47 Vulture Sam (R-28)
- T-48 Willy the Kid unlimited BANG! (R-29)

**Information hiding**
- T-49 `toPlayerView` never includes other players' hand contents, hidden roles, deck order or rng state.
- T-50 `redactEvent` hides drawn card identities from non-owners; draw! reveals are public.
- T-51 Determinism: same seed + same action list ⇒ identical states and events.
