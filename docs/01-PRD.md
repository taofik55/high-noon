# 01 — Product Requirements (PRD)

## 1. Vision
Bang! as you know it at the table, but alive: a cinematic Wild West town where every card you play becomes a scene.
The card game remains the heart of the experience — same roles, characters, cards and rules as the base game — and the
3D world makes it dramatic, readable and fun to watch even when it's not your turn.

## 2. Goals
- G1. 100% faithful implementation of the Bang! base game (4–7 players).
- G2. Every card effect and character death has a recognizable 3D staging (see docs/05).
- G3. Online play with friends through room codes, no account required.
- G4. Solo play against NPCs with three difficulty levels.
- G5. Smooth on a mid-range desktop (60 fps target at "High"), playable on lower hardware with presets.

## 3. Non-goals (v1)
- Expansions (Dodge City, High Noon expansion, Fistful of Cards, etc.).
- Public matchmaking, ranked ladder, chat moderation, monetization.
- Free-roam open world with character movement controlled by the player (the town is a stage, not an MMO).
- Native mobile apps.

## 4. Audience & context
The owner and their friends, playing privately. The site is `noindex`, optionally gated by a shared password
(`SITE_PASSWORD`), and uses original artwork and the working title "High Noon".

## 5. Game modes
### 5.1 Solo vs NPC
- Choose player count (4–7), your nickname, NPC difficulty (global or per seat).
- Runs fully in the browser (engine + AI in a Web Worker). No server needed. State auto-saved to localStorage so a
  refresh can resume.

### 5.2 Online room
- Host creates a room → gets a 6-character code (e.g. `K7QX2M`) and a share link `/r/K7QX2M`.
- Lobby: 7 slots. Host can: add/remove NPC in empty slots (choose difficulty), kick a player, change settings, start
  when 4–7 seats are filled and all humans are ready.
- During the game, a disconnected human keeps their seat. After N consecutive timeouts (setting, default 2), the seat is
  controlled by a Medium NPC until the human comes back.
- Rematch button at the end keeps the same room and seats.

## 6. Settings
| Setting | Options | Default |
|---|---|---|
| Turn / response timer (online) | off, 30s, 60s, 90s | 60s |
| Character selection | random 1, choose 1 of 2 (variant) | random 1 |
| Cinematics | full, short, off | full |
| Animation speed | 1x, 1.5x, 2x | 1x |
| Graphics quality (local) | low, medium, high, ultra, auto | auto |
| Audio | master, music, sfx volumes | 80/50/80 |
| Language | Bahasa Indonesia, English | Bahasa Indonesia |
| Reduce motion (accessibility) | follow system, on, off | follow system |
| Large text (accessibility) | on, off | off |
| Four-colour suits (accessibility) | on, off | off |

**As built (Phase 13):** all local settings live in `settingsStore` (persisted in localStorage) and are edited in one
panel, at `/settings` and in the in-game "Pengaturan" dialog. Reduce motion caps cinematics at "short" (no flying
camera, no shake, walk-outs or camera dollies) and turns off CSS animations. The language switch re-renders the app in
place (the server and hydration always render Bahasa Indonesia; `SettingsRoot` switches right after hydration); a solo
game in progress is saved and resumes, online games resync. A first-game tutorial (8 coach marks over the live table)
can be replayed from the settings. Touch devices force the low preset; the TABLE camera backs off on portrait screens.

## 7. Core user flows
1. **First visit:** (optional password) → enter nickname → anonymous sign-in → home.
2. **Home:** "Main Solo", "Buat Room", "Gabung Room" (enter code), Settings, optional "Masuk dengan Google".
3. **Lobby:** seats, ready toggles, host controls, room code copy button, presence indicators.
4. **Game start:** role reveal (only you see your role; Sheriff revealed to all), character reveal with intro shot of
   each character at their spot in the town square.
5. **Turn:** start-of-turn checks (Dynamite, Jail) → draw phase → play phase → discard phase → next player.
6. **Response:** when targeted, a prompt appears with legal responses highlighted and a countdown.
7. **End:** cinematic of the winning team, all roles revealed, summary (kills, damage dealt, cards played), Rematch / Exit.

## 8. Feature list and priorities
| ID | Feature | Priority |
|---|---|---|
| F1 | Rules engine with all 22 card types, 16 characters, 4 roles | P0 |
| F2 | Solo mode with NPC easy/medium/hard | P0 |
| F3 | 2D debug table (dev only) | P0 (dev) |
| F4 | 3D town scene with seats, placeholder characters, 3D cards, hand HUD, targeting | P0 |
| F5 | Director: cinematic sequence for every event type, skip / speed | P0 |
| F6 | Anonymous auth + nickname | P0 |
| F7 | Rooms, lobby, presence, NPC slots | P0 |
| F8 | Online authoritative gameplay, reconnect, timeouts, NPC takeover | P0 |
| F9 | Real 3D assets, shared animation set, audio, post-processing | P1 |
| F10 | Graphics presets, performance budget, loading screen | P1 |
| F11 | Google sign-in with identity linking | P1 |
| F12 | Game log panel, card tooltips (rules text), tutorial overlay | P1 |
| F13 | Stats per user (games, wins by role) | P2 |
| F14 | Mobile layout (optional) | P2 |
| F15 | Spectator mode | P2 |

## 9. HUD requirements (always visible on top of 3D)
- Your hand as a fan of 3D cards (bottom). Hover = lift + enlarge + rules tooltip. Click/drag to play.
- Your role card (peekable), character card with ability text, life shown as bullets.
- For every other player: name, character portrait, life bullets, hand count, cards in play (3D in world + compact HUD
  badge), distance from you, Sheriff star, "in range" indicator for your current weapon.
- Deck count, discard pile top card, turn indicator, phase indicator, timer ring, game log (collapsible).
- Prompt panel for responses and choices (Missed!/Beer/Take hit, General Store pick, Kit Carlson pick, etc.).

## 10. Success criteria
- Engine passes all rule test cases in docs/02 and 10,000 simulated bot games with zero illegal states or crashes.
- An online 7-player game with friends completes without desync; refresh mid-game resumes within 3 seconds.
- First playable frame under 5 s on broadband (placeholders allowed while assets stream).
- Friends who know Bang! can play without explanation.
