# 08 — Roadmap & Prompts for Claude Code

**Cara pakai:** satu fase = satu sesi Claude Code. Mulai sesi, tempel prompt fase itu, biarkan Claude Code menyusun
rencana dulu, review, setujui, lalu biarkan bekerja. Setelah fase selesai dan kamu sudah mencoba hasilnya: commit,
`/clear`, lanjut fase berikutnya. Jangan gabung beberapa fase dalam satu prompt.

Urutannya sengaja: **aturan game benar dulu → bisa dimainkan dalam 2D → baru 3D → baru online → baru aset asli.**
Dengan begitu, bug aturan tidak bercampur dengan bug grafis atau jaringan.

| Fase | Isi | Hasil yang bisa kamu coba |
|---|---|---|
| 0 | Bootstrap project | `pnpm dev` jalan, lint/test/typecheck hijau |
| 1 | Engine: fondasi | test aturan dasar lulus |
| 2 | Engine: semua kartu coklat | test T-10…T-19 lulus |
| 3 | Engine: kartu biru | test T-20…T-24 lulus |
| 4 | Engine: karakter, kematian, menang, view | semua test T-1…T-51 lulus |
| 5 | NPC AI + simulasi | `pnpm sim` 10.000 game tanpa error |
| 6 | Meja debug 2D | main solo lengkap lawan bot di browser (tanpa 3D) |
| 7 | Fondasi 3D | kota placeholder, karakter kapsul, kartu 3D, drag ke target |
| 8 | Director & sinematik | setiap kartu punya adegan (dengan placeholder) |
| 9 | Supabase dasar | login anonim + nickname, Google link, password situs |
| 10 | Room & lobby | buat/gabung room, slot NPC, ready, presence |
| 11 | Main online | game online penuh, reconnect, timer, NPC ambil alih |
| 12 | Aset asli & audio | karakter, animasi Mixamo, kota, suara |
| 13 | Polish & performa | preset grafis, loading, tutorial, (opsional HP) |
| 14 | Deploy | live di Vercel + Supabase production |

---

## Fase 0 — Bootstrap
```
Read CLAUDE.md and all files in docs/ first. We are starting Phase 0 (Bootstrap) from docs/08-ROADMAP-AND-PROMPTS.md.

Goal: scaffold the project in this folder without deleting CLAUDE.md or docs/.
- Create a Next.js app (App Router, TypeScript strict, ESLint, src/ dir, Tailwind for 2D UI) with pnpm. If the
  scaffolder refuses a non-empty folder, scaffold into a temp folder and move the files in.
- Install: three, @react-three/fiber, @react-three/drei, @react-three/postprocessing, zustand, gsap, zod, immer,
  @supabase/supabase-js, @supabase/ssr; dev: vitest, @vitest/coverage-v8, playwright, tsx. Use current stable versions
  and verify their current APIs in their docs.
- Create the folder layout from CLAUDE.md with index files and short README comments where useful.
- Scripts: dev, build, typecheck, lint, test, test:watch, sim (tsx scripts/sim.ts), e2e.
- ESLint rules enforcing engine/ai purity (Golden rule 2): no-restricted-imports for react, three, next, @supabase/*,
  src/game3d, src/ui, src/server inside src/engine and src/ai; no-restricted-globals for Math.random/Date/window/document.
  Add a deliberate failing example in a test fixture to prove the rule works, then remove it.
- Add .env.example (from CLAUDE.md), robots.txt disallow all, noindex metadata, a simple placeholder home page
  showing NEXT_PUBLIC_GAME_TITLE.
- Add a GitHub Actions workflow running typecheck, lint, test.
- Initialize git and make the first commit.

Done when: pnpm dev serves the home page, and pnpm typecheck && pnpm lint && pnpm test all pass.
Propose your plan first and wait for my approval.
```

## Fase 1 — Engine: fondasi
```
Read CLAUDE.md, docs/02-GAME-RULES.md and docs/03-ARCHITECTURE.md §2. Phase 1: engine foundation in src/engine.

Implement:
- Types: Seat, Suit, Role, CardType (all 22), Card, CharacterId (all 16, data only for now), PlayerState, GameState,
  Prompt, Action, GameEvent (discriminated unions as in docs/03 §2.2–2.5; extend where needed and update the doc).
- Seeded serializable RNG (rng.ts) with shuffle; no Math.random anywhere.
- deck.ts: all 80 cards with stable ids c01..c80, counts exactly as docs/02 §1.3, suits/ranks per Ruling R-1.
- characters data (name, life, ability id) and role tables.
- createGame(config, seed): roles, characters (random mode and choose_of_2 mode with a CHOOSE prompt), life, starting
  hands, Sheriff starts.
- Turn flow with the prompt stack + advance() loop: start-of-turn hook (empty for now), draw phase (draw 2), play phase
  with END_TURN, discard phase (DISCARD_EXCESS), next living player. Deck reshuffle (R-8).
- Distance calculation (docs/02 §3) as a pure helper.
- Cards in this phase: BANG! (range, 1-per-turn limit), Missed! (response only), Beer (incl. R-6, R-7).
- Damage → dying prompt (Beer) → elimination (role reveal, discard all) → win check (docs/02 §8).
- getLegalActions, applyAction (throws IllegalActionError with a reason), currentActor.
- Test helpers: a scenario builder to create specific states (choose seats, roles, characters, hands, deck order).

Tests: T-1 to T-6, T-8, T-10 (BANG part), T-11, T-12, T-25, T-29 to T-31, T-51.
Done when: pnpm typecheck && pnpm lint && pnpm test pass. Propose the plan first.
```

## Fase 2 — Engine: kartu coklat
```
Read CLAUDE.md and docs/02-GAME-RULES.md §6. Phase 2: implement all remaining brown cards in the engine:
Panic!, Cat Balou (card named in the action Target: random hand card or specific in-play card), Stagecoach,
Wells Fargo, Gatling (MULTI_TARGET driver, clockwise order R-11, R-12), Indians!, Duel (alternating, damage source
= opponent), General Store (STORE_PICK order), Saloon. Emit the events listed in docs/03 §2.5 with enough data for
animation. Tests: T-7 (distance part relevant to Panic!), T-9, T-13 to T-19, T-32.
Keep all previous tests green. Propose the plan first.
```

## Fase 3 — Engine: kartu biru
```
Read CLAUDE.md and docs/02-GAME-RULES.md §4.1, §5, §6.1. Phase 3: blue cards.
Weapons (Volcanic unlimited BANG!, ranges, replace old weapon), Barrel (auto draw! before Missed! prompt, R-9),
Scope, Mustang, Jail (never on Sheriff, start-of-turn check, skip turn), Dynamite (start-of-turn check before Jail,
3 damage, pass left, R-3, R-4, R-5, R-16). Generic "draw!" mechanism with a hook for Lucky Duke later.
No duplicate blue card names per player. Tests: T-7, T-20 to T-24. Keep everything green. Propose the plan first.
```

## Fase 4 — Engine: karakter, hadiah/hukuman, view
```
Read CLAUDE.md, docs/02-GAME-RULES.md §7–§9 and docs/03-ARCHITECTURE.md §2.6. Phase 4:
- All 16 character abilities with rulings R-17 to R-29 (Jesse/Pedro/Kit draw choices, Lucky Duke pick, Sid Ketchum
  ABILITY action usable anytime incl. dying, Suzy trigger after effect steps, Vulture Sam pickup, etc.).
- Kill credit, Outlaw bounty, Sheriff-kills-Deputy penalty (R-15), multi-point damage (R-14).
- toPlayerView and redactEvent with strict information hiding; defaultActionOnTimeout for every prompt kind.
- A property-style test that plays random legal actions for 500 seeded games and checks invariants (80 cards
  conserved, life ≤ max, dead players hold no cards, views never contain hidden info).
Tests: everything up to T-51 must pass. Then write docs/ENGINE-NOTES.md summarizing any interpretation you made.
Propose the plan first.
```

## Fase 5 — NPC AI + simulasi
```
Read CLAUDE.md and docs/06-AI-NPC.md. Phase 5: implement src/ai with easy, medium and hard brains, role inference
memory, the legality wrapper, and scripts/sim.ts (pnpm sim) exactly as docs/06 §6 describes, including invariant
checks and a summary report (win rate by role and difficulty, avg turns, failing seeds). Make the hard brain respect
a time budget. Done when 10,000 simulated games run with zero invariant violations and difficulty ordering holds.
Propose the plan first.
```

## Fase 6 — Meja debug 2D (bisa main solo)
```
Read CLAUDE.md, docs/01-PRD.md §9 and docs/03-ARCHITECTURE.md §4. Phase 6: a plain 2D (HTML/Tailwind) debug table at
/dev/table and the shared client pipeline:
- GameAdapter interface + LocalAdapter (engine in main thread is fine for now; AI in a Web Worker).
- gameStore with update queue and presentedView (Director stub that just applies updates with a short delay).
- 2D table: players in a circle with life, hand count, in-play cards, roles when visible; my hand as clickable cards;
  card → target selection driven only by legalActions; prompt panel for every prompt kind; game log; settings for
  player count and NPC difficulty; game over screen with roles. All text via src/ui/i18n (Bahasa Indonesia).
- Solo game state saved to localStorage and resumable.
Done when I can play full solo games against bots in the browser with no rule problems. Propose the plan first.
```

## Fase 7 — Fondasi 3D
```
Read CLAUDE.md, docs/05-3D-WORLD-AND-ANIMATION.md and docs/07-ASSETS-GUIDE.md §4. Phase 7: the 3D table at /play/solo
using ONLY placeholders (docs/05 §11):
- R3F Canvas, AssetRegistry + manifest with placeholder fallbacks, town square layout per docs/05 §2 with box buildings,
  ground, sky, sun light, fog, quality preset plumbing (low..ultra, auto).
- Seat ring for 4–7 players, placeholder characters tinted per seat, crate with in-play cards as 3D card meshes,
  HUD overlays (name, life bullets, hand count, Sheriff star, distance/in-range badge).
- 3D card mesh with canvas-generated textures; hand fan in an overlay scene with hover lift + rules tooltip;
  drag-to-target and click-click targeting with glowing valid targets; deck and discard pile on the center wagon.
- Camera modes TABLE and FOCUS with smooth transitions; FREE mode in dev.
- Reuse the Phase 6 gameStore/LocalAdapter; prompts and log as HTML overlays.
Done when a full solo game is playable in 3D (animations can be instant). Propose the plan first.
```

## Fase 8 — Director & sinematik
```
Read CLAUDE.md and docs/05-3D-WORLD-AND-ANIMATION.md §3, §6. Phase 8: implement the Director with the Sequence
interface, priority matching, full/short/off modes, speed, skip (button + Space), NPC thinking pauses, and every
sequence in the catalogue §6.1 using placeholder characters and procedural tween "animations", simple VFX (muzzle
flash, tracer, dust, explosion particles, glow) and the camera CINEMATIC mode. Structure it so real Mixamo clips can be
plugged in later by clip name (docs/05 §5). Done when every card and event has a recognizable scene and the game stays
correct with cinematics off. Propose the plan first.
```

## Fase 9 — Supabase dasar
```
Read CLAUDE.md, docs/03-ARCHITECTURE.md §5–6 and docs/04-DATABASE.md. Phase 9:
- Supabase local setup (config.toml with anonymous sign-ins and manual linking), migration 0001_init.sql exactly as
  docs/04 §3, generated types.
- Browser/server Supabase clients with @supabase/ssr, proxy (src/proxy.ts, Next 16's renamed middleware) for session
  refresh + optional SITE_PASSWORD gate.
- First-visit flow: nickname → signInAnonymously with display_name → profile; edit nickname; "Masuk dengan Google"
  using linkIdentity (keeps same user id), and sign-in with Google on a new device.
- src/server/supabaseAdmin.ts with 'server-only'.
- Write SQL tests (or a vitest integration test against local Supabase) proving RLS: a user cannot read games.state,
  other users' player_views or private events.
Tell me exactly what I must configure in the Supabase dashboard and Google Cloud. Propose the plan first.
```

## Fase 10 — Room & lobby
```
Read CLAUDE.md, docs/01-PRD.md §5.2, docs/03-ARCHITECTURE.md §5.4 and docs/04-DATABASE.md. Phase 10: rooms API route
handlers with zod validation (create, join by code, leave, host add/remove NPC with difficulty, kick, ready toggle,
settings), lobby page /r/[code] with slots, presence indicators, copy code/link, host controls, start button enabled
only with 4–7 seats and all humans ready. Start creates the game via the engine and the commit RPC (game_seats,
initial views/events). Done when two browsers (normal + incognito) can create, join and start a room.
Propose the plan first.
```

## Fase 11 — Main online
```
Read CLAUDE.md, docs/03-ARCHITECTURE.md §5 and docs/04-DATABASE.md. Phase 11: authoritative online gameplay.
- gameService: load → applyAction → NPC loop (incl. afk_takeover seats) → views + redacted events → commit RPC with
  optimistic version and one retry. Route handlers action, timeout, resync. Rate limiting.
- OnlineAdapter per docs/03 §5.3 (realtime on player_views, fetch events by version, merge private over public,
  reconnect handling, timeout reporting with jitter).
- /play/online/[gameId] reusing the same 3D scene and Director as solo.
- Game over: room status, stats update, rematch.
- Playwright e2e: 2 human browsers + 2 NPCs play until game over with cinematics off.
Done when a full online game with friends works, refresh mid-game resumes, and no hidden info appears in network
responses (verify in tests). Propose the plan first.
```

## Fase 12 — Aset asli & audio
```
Read CLAUDE.md, docs/05 and docs/07. Phase 12: integrate the real assets I have put in public/assets/ (list them,
tell me what is missing). Build a /dev/assets viewer (model, clips, tri count, texture sizes). Wire character GLBs to
the shared Mixamo animation set with the clip-name state machine, weapon attachment per equipped card, horses, town
set pieces, card art textures, positional audio and music with volume settings. Keep placeholders as fallback for
anything missing. Write a Blender Python script if clip renaming/merging is needed. Update CREDITS.md and an in-game
credits screen. Propose the plan first.
```

## Fase 13 — Polish & performa
> **Status: selesai.** Overlay perf, LOD karakter, static batching kota, post-processing per preset, governor auto,
> loading screen + streaming bertahap, halaman/dialog pengaturan (bahasa, kurangi gerakan, teks besar, suit 4 warna),
> tutorial, tooltip pemain/kartu, mode ponsel ringan. Angka sebelum/sesudah: docs/05 §9.
```
Read CLAUDE.md, docs/01-PRD.md §6, docs/05 §7–§9. Phase 13: graphics presets with auto adaptation, loading screen
with progressive asset streaming, performance pass to meet the budget (instancing, merged static geometry, LOD, texture
sizes, draw-call count overlay in dev), settings page, tutorial overlay for first game, card tooltips, accessibility
(reduce motion, readable fonts, color-blind friendly suits). Optional: mobile layout with tap-to-select and forced low
preset. Report before/after fps and draw calls. Propose the plan first.
```

## Fase 14 — Deploy
```
Read CLAUDE.md and docs/04-DATABASE.md §2. Phase 14: production deployment checklist and fixes:
- Create/link the Supabase production project, push migrations (supabase db push), configure auth URLs.
- Vercel project settings, env vars (production + preview), Node runtime for route handlers, caching headers for
  /assets (immutable, long max-age), SITE_PASSWORD.
- Smoke test script against the production URL. Give me a step-by-step list of what I must click in Vercel and
  Supabase dashboards.
Propose the plan first.
```

---

## Template prompt tambahan

**Laporan bug aturan**
```
Bug in the rules engine. Read docs/02-GAME-RULES.md first.
Situation: <apa yang terjadi, siapa main kartu apa, karakter apa>
Expected (with rule ID if known): <yang seharusnya>
Actual: <yang terjadi>
First write a failing Vitest test that reproduces it using the scenario builder, then fix it, then run all tests.
```

**Laporan bug visual/animasi**
```
Visual bug in the 3D layer (engine is correct). Read docs/05 first.
Where: <adegan/kartu>, Settings: <quality, cinematics, speed>, Browser: <…>
What happens: <…>  Expected: <…>
Fix it without touching src/engine. Show me what you changed.
```

**Lanjut sesi yang terputus**
```
Read CLAUDE.md and docs/08. Check git log and the current code to determine where Phase <N> stopped.
Summarize what is done and what is left, then continue after my approval.
```
