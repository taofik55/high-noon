# CLAUDE.md — High Noon (private 3D Wild West adaptation of the Bang! base game)

> Working title "High Noon" is configurable via `NEXT_PUBLIC_GAME_TITLE`. This is a **private project for
> personal play with friends**. Use original art and the working title; never ship official Bang! artwork or logos.

## What this project is
A web-based, desktop-first 3D game that implements the **Bang! base game rules exactly** while staging every
action in a living Wild West town: characters really draw and fire on BANG!, duel on main street, dive behind
barrels, get raided on Indians!, blow up with Dynamite, get dragged to jail, drink in the saloon. The cards stay
visible and central: a 3D hand fan, 3D cards in front of each player, a deck and discard pile in the world.

- **Modes:** Online rooms (6-char room code, 4–7 seats, empty seats can be NPCs) and Solo vs NPCs (easy / medium / hard),
  which runs entirely client-side.
- **Auth:** Supabase anonymous sign-in by default (just enter a nickname). Optional Google sign-in that **links** to the
  same anonymous account (same user id).
- **Platforms:** desktop browsers first. Mobile is optional (low-quality preset, simplified controls).

## Read before working (mandatory)
| Working on | Read first |
|---|---|
| Anything | `docs/01-PRD.md` |
| Game rules, engine, tests | `docs/02-GAME-RULES.md`, `docs/03-ARCHITECTURE.md` |
| Supabase, API routes, realtime | `docs/03-ARCHITECTURE.md`, `docs/04-DATABASE.md` |
| 3D scene, animation, camera, VFX, audio | `docs/05-3D-WORLD-AND-ANIMATION.md`, `docs/07-ASSETS-GUIDE.md` |
| NPC bots | `docs/06-AI-NPC.md`, `docs/02-GAME-RULES.md` |
| Which phase we are in, scope | `docs/08-ROADMAP-AND-PROMPTS.md` |

If the docs and the code disagree, stop and ask. If you make a justified change to architecture, schema or rules
interpretation, update the relevant doc in the same commit.

## Tech stack
- **Next.js** (App Router, latest stable) + **TypeScript strict**, package manager **pnpm**, deployed on **Vercel**
- **React Three Fiber**, **@react-three/drei**, **@react-three/postprocessing**, **three.js**
- **Zustand** (client state), **GSAP** (timelines), **Howler** or three `PositionalAudio` (audio)
- **Supabase**: Auth (anonymous + Google identity linking), Postgres with RLS, Realtime (postgres_changes + presence)
- **Vitest** (unit/rules tests), **Playwright** (e2e smoke)
- Always use current stable versions and check current docs for R3F/drei/Supabase/Next.js APIs rather than memory.

## Repository layout
```
src/
  app/                    Next.js routes: pages + route handlers
    api/rooms/            create, join, [id]/seat (ready/leave/NPC/kick), [id]/settings, [id]/start
    api/games/[id]/       action / timeout / resync
  engine/                 PURE rules engine (see Golden rule 1–2)
    cards/  characters/  rules/  state/  events/  view/  rng.ts  index.ts
  ai/                     NPC brains: pure functions of PlayerView (+ seeded rng)
  game3d/                 R3F scene: world/, characters/, cards/, director/ (cinematics), vfx/, audio/, assets/
  ui/                     2D React UI: menus, lobby, HUD overlays, prompts, settings, i18n/
  net/                    GameAdapter implementations: LocalAdapter (solo), OnlineAdapter (Supabase)
  server/                 server-only: supabase admin client, gameService (load → apply → npc loop → commit)
  lib/supabase/           browser + server clients, generated types
  config/
supabase/migrations/      SQL migrations (schema in docs/04-DATABASE.md)
public/assets/            optimized .glb, textures, audio, card art
tests/                    vitest specs (engine rules mirror docs/02 test IDs), e2e/
scripts/sim.ts            bot-vs-bot simulation harness
```

## Golden rules
1. **Engine is the single source of truth.** All rules live in `src/engine` as pure deterministic functions:
   `createGame(config, seed)`, `getLegalActions(state, seat)`, `applyAction(state, seat, action) → { state, events }`,
   `toPlayerView(state, seat)`, `redactEvent(event, viewerSeat)`. Randomness only through the seeded RNG stored in state.
2. **Engine purity:** no React, three, Next, Supabase, DOM, Node APIs, `Date.now()` or `Math.random()` inside
   `src/engine` or `src/ai`. Enforce with ESLint `no-restricted-imports` / `no-restricted-globals`.
3. **Never trust the client.** Online, clients send intents to `/api/games/[id]/action`; the server re-validates with the
   engine and commits atomically with optimistic versioning.
4. **Never leak hidden information.** The full `GameState` never leaves the server in online games. Clients receive only
   their `PlayerView` and redacted events. Hidden: other players' hand contents (count only), roles (except Sheriff and
   eliminated players, until game end), deck order, RNG state.
5. **3D is presentation only.** The 3D layer consumes engine events through the Director queue and never mutates game
   state. The game must be fully playable with cinematics set to "off".
6. **Placeholders first.** Every 3D asset has a primitive fallback in the AssetRegistry. Never block a feature on art.
7. **UI derives from `getLegalActions`.** Only highlight legal cards/targets; never re-implement rules in UI code.
8. **Tests are part of done.** Every rule, card and character has Vitest coverage keyed to the test IDs in
   `docs/02-GAME-RULES.md`. Run `pnpm typecheck && pnpm lint && pnpm test` before saying a task is complete.
9. **NPCs never cheat.** At every difficulty an NPC decides only from its own `PlayerView`.
10. **Stay in phase scope** (`docs/08-ROADMAP-AND-PROMPTS.md`). Propose a plan first, wait for approval on large phases,
    don't start the next phase unasked, commit at the end of each phase.
11. **Ask before** adding heavy dependencies, changing the DB schema, or deviating from the architecture.
12. **Secrets:** the Supabase secret (service role) key is used only in `src/server` and route handlers. Never prefix it
    with `NEXT_PUBLIC_`, never import `src/server` from client components (use `import 'server-only'`).

## Commands
```
pnpm dev            # Next.js dev server
pnpm build          # production build
pnpm typecheck      # tsc --noEmit
pnpm lint
pnpm test           # vitest run
pnpm test:watch
pnpm sim -- --games 1000 --players 4-7 --difficulty mixed   # bot-vs-bot harness
pnpm smoke -- --url https://…   # production smoke test (docs/DEPLOY.md)
pnpm e2e            # playwright smoke
pnpm db:start | pnpm db:stop | pnpm db:reset      # local Supabase (Docker), ports 553xx
pnpm db:types       # supabase gen types typescript --local > src/lib/supabase/types.ts
pnpm test:db        # RLS tests against the local stack (pnpm test does not need Docker)
pnpm exec supabase migration new <name>
```

## Environment variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=     # (anon / publishable key)
SUPABASE_SECRET_KEY=                       # (service role / secret key) server only
NEXT_PUBLIC_GAME_TITLE=High Noon
SITE_PASSWORD=                             # optional shared password gate for friends
NEXT_PUBLIC_GOOGLE_AUTH=                   # "true" once the Google provider is set up (docs/DEPLOY.md)
```

## Code style
- TypeScript strict, no `any`. Discriminated unions for `Action`, `GameEvent`, `Prompt`.
- Card types and character ids are string-literal unions; card instances have stable ids `c01`…`c80`.
- Small files, named exports, no default exports except Next.js pages/layouts.
- User-facing text in **Bahasa Indonesia** through `src/ui/i18n` (English fallback). Card names keep their English
  names (BANG!, Missed!, Beer…).
- Comments explain *why*, not *what*. Every non-obvious rule ruling cites its ID from `docs/02-GAME-RULES.md`.
