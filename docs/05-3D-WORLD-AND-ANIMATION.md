# 05 — 3D World, Camera, Cinematics & Animation

## 1. Art direction
- **Stylized-realistic Western**: PBR materials, warm golden-hour light, dusty atmosphere, long shadows. Realistic
  proportions, slightly exaggerated silhouettes for readability (big hats, clear weapons).
- Palette: sun-bleached wood, rust, sand, deep sky blue, saloon amber. UI: aged paper, brass, leather.
- Readability over realism: in "table view" every player, their life and their cards must be readable at a glance.

- **Decision (Phase 12): every 3D asset is procedural three.js** (no Mixamo, Blender, AI generators or downloaded
  models). Direction refined to a **stylized low-poly Western diorama**: custom BufferGeometry sweeps (superellipse
  rings along paths) for anatomy and clothing, Extrude/Lathe/Shape geometry with bevels for hard surfaces, vertex
  colours on a few shared `MeshStandardMaterial`s, faint procedural canvas grain, and a procedural environment map
  (RoomEnvironment) so metals read. Code: `src/game3d/procedural/` (core builders, character on one shared 22-bone
  skeleton with hand-keyed clips, weapons, buildings), inspected at `/dev/assets`. Budgets: character ≤ 25k
  triangles in ~7 draw calls; buildings ~a dozen draw calls via InstancedMesh for boards/balusters/brackets.

## 2. The stage: town square of High Noon
```
                 [ Saloon ]        [ Sheriff's Office + Jail ]
        [Bank/Wells Fargo]   ┌──────────────────────┐   [General Store]
                             │   TOWN SQUARE         │
   main street ◄─────────────┤  seats in a ring      ├────────────► main street (duel lane)
                             │  around a well/wagon  │
       [Stable / horses]     └──────────────────────┘   [Undertaker]
                 [ Water tower ]        [ Stagecoach stop ]
            desert, mesas, cacti, distant canyon (backdrop, low-poly + HDRI sky)
```
- The **seat ring**: 4–7 seat spots on a circle (radius ~6 m) in the square, ordered clockwise like the table. Each seat
  has: the character, a small crate/table in front showing their **in-play blue cards as 3D cards**, a floating name
  plate + life bullets (HTML overlay anchored with drei `Html` or a screen-space HUD badge), Sheriff star, a dynamite
  stick or jail chain visual when relevant.
- The deck and discard pile sit on the central wagon/well.
- Implementation (Phase 7): name plates are screen-space DOM badges (`game3d/hud/SeatBadges` + `BadgeTracker`, moved
  each frame through refs) rather than drei `Html`, which created one React root per badge and logged unmount races
  under React 19. Seats are laid out by `world/layout.ts` (`seatPosition`: you at the front, clockwise to your left).
- Buildings are functional set pieces used by cinematics (Saloon for Beer/Saloon, Jail for Jail, Bank/stagecoach for
  Stagecoach & Wells Fargo, General Store for General Store, main street for Duel, desert edge for Indians!).

## 3. Camera system
| Mode | Use | Notes |
|---|---|---|
| `TABLE` | default during decisions | elevated 3/4 view of the ring from behind your seat, all players visible. Slight parallax on mouse. |
| `FOCUS(seat)` | hover/select a target | smooth dolly toward a player, shows their cards bigger. |
| `CINEMATIC(shot)` | during sequences | scripted shots (over-shoulder, close-up, wide, tracking). |
| `FREE` (debug) | dev only | orbit controls. |
Use drei `CameraControls` for smooth transitions (`setLookAt(..., true)`), GSAP for scripted paths. Always return to
`TABLE` when a sequence ends or is skipped. Respect "reduce motion" setting (no shakes, cuts instead of swoops).

## 4. Cards in 3D
- Card mesh: rounded rectangle (63×88 ratio), slight thickness, front texture (card art + name + rules icon + suit/rank
  corner), back texture (original design). One shared geometry, textures via a texture atlas or individual KTX2/WebP.
- **Hand**: rendered in a separate overlay scene (drei `Hud` or a second camera) as a fan at the bottom. Hover lifts and
  scales the card; a 2D tooltip shows full rules text. Illegal cards are dimmed (from `legalActions`).
- **Playing**: drag a card onto a highlighted target player (or click card → click target). Targets in range glow
  (rim light + ground ring). Self/global cards (Beer, Saloon, Gatling, Indians!, Stagecoach, Wells Fargo, General Store,
  blue self-cards) play by dragging up onto the table or double-click; a single click only selects them (a "Play"
  button appears) so a stray click never wastes a card. The prompt panel always lists the same targets and choices as
  buttons. Selection logic is shared with the 2D table (`ui/table/useTableInteraction`, from `legalActions` only). A
  drop resolves the seat by R3F hover or, as a fallback, by the nearest projected character (`game3d/seatPicker`).
- Card flight: played card flies from hand (or opponent's hand position) to the center, flips face-up, then goes to the
  discard pile or the target's crate.
- draw! check: the top card flips huge in front of the camera with the suit glowing; success = gold flash, failure = red.

## 5. Characters
- All humanoids share **one skeleton** (Mixamo standard) so every animation clip works for every character.
- Each of the 16 characters has a distinct look (outfit, hat, color accents, signature prop). Recommend 4–6 base bodies
  with swapped outfits/textures to keep the workload sane (see docs/07).
- Per-character `CharacterRig` component: loads GLB, attaches the weapon mesh to the right-hand bone matching the
  equipped weapon card (Colt .45 default, Volcanic, Schofield, Remington, Rev. Carabine, Winchester = long gun), plays clips
  via drei `useAnimations` and a small **animation state machine** with crossfades.
- Clip names (shared): `Idle`, `IdleArmed`, `Draw`, `Aim`, `Shoot`, `ShootRifle`, `HitReact`, `Dodge`, `CoverCrouch`,
  `Death_A`, `Death_B`, `Drink`, `Cheer`, `Walk`, `Run`, `Throw`, `Grab`, `Lasso`, `SitJail`, `Taunt`, `Shrug`.
- Idle variety: occasional fidget (spin revolver, adjust hat) on random timers when not acting.
- Status visuals: Jail = shackles/jail-cell ghost behind them; Dynamite = lit stick on their belt with sparks;
  Mustang = horse tied behind their seat; Scope = spyglass on belt; Barrel = barrel next to them; low life = limping idle.

- Implemented (Phase 12): every seat builds its character from `procedural/character/roster.ts` on the shared
  22-bone skeleton. `characters/skeletalRig.ts` implements `RigApi` with an `AnimationMixer`: clip names cross-fade to
  the hand-keyed clips (all 19 Director clips plus Walk and Ride); held clips (Draw, Aim, deaths, SitJail,
  CoverCrouch, Lasso) keep their last frame until the next view resets the rig; Dodge, Grab and HitReact add a small
  root motion on the seat's animation group; `moveTo` walks. The gun is the equipped weapon card's model: revolvers
  sit in the holster and move to the hand during Draw (and for Aim/Shoot); long guns sling across the back. Dead
  players rest in the last frame of Death_A beside a headstone. Status props (`characters/SeatProps.tsx`): a barred
  cell for Jail, a barrel, a saddled horse for Mustang, dynamite and a spyglass on the belt. If a character cannot be
  built, the seat falls back to the placeholder capsule and its tween rig.
- Town and props: layout buildings are the procedural models with their front wall where the layout box's front
  was; cacti and boulders are procedural; the deck sits on a buckboard; scene props (Gatling wagon, stagecoach with a
  galloping team, a rider, tumbleweed, bottle) are procedural and shared, so the VFX layer only removes them.

## 6. Director (cinematic system)
`src/game3d/director/` — consumes `GameUpdate`s from the store queue.

```ts
interface Sequence {
  id: string
  match(events: GameEvent[], i: number): number          // how many events this sequence consumes (0 = no match)
  build(ctx: DirectorContext, events: GameEvent[]): Timeline // GSAP timeline: camera + anims + vfx + sfx
  shortVersion?: (ctx, events) => Timeline                // for cinematics = "short"
}
```
- Sequences are matched in priority order against the event list; unmatched events get a generic quick animation
  (card flight + log).
- `cinematics = off` → only card flights and status updates (≤ 400 ms per event). `short` → 1–2 s. `full` → 2–6 s.
- Speed multiplier scales the timeline (`timeline.timeScale(speed)`).
- **Skip** button (and Space key) finishes the current timeline instantly and fast-forwards queued updates.
- NPC "thinking": before presenting an NPC action, wait 400–1200 ms (scaled by speed) with a thinking pose.
- A sequence must never be required for correctness; it reads `presentedView` and events only.

**Implementation (Phase 8, `src/game3d/director/`):**
- `planner.ts` (pure) splits an update's redacted events into steps, one per sequence, in priority order; only
  bookkeeping events (`QUIET_EVENTS`) fall to `generic`. `sequences.ts` builds one GSAP timeline per step from the
  context's rig / VFX / camera APIs; `Director.ts` plays them as the store's `Presenter` (docs/03 §4.2).
- **Scenes are self-contained per update.** Every newly presented view resets all character rigs to their seat pose
  (before paint), so a multi-update action (Duel) walks out and back inside one scene, and a held pose (death fall)
  never stacks with the static pose of the next view (dead players lie down, with a gravestone).
- Clip names are the shared Mixamo list (`types.ts ClipName`); placeholders implement them as procedural tweens
  (`clips.ts`). Draw/Aim lean in until Shoot; Death_*, SitJail, CoverCrouch, Lasso hold until the reset.
- Short cinematics skip camera moves and lead-in poses and show only the deciding draw! (Jourdonnais + Barrel can
  make two). Unit tests check every step of hundreds of real updates against the budgets: full ≤ 6 s, short ≤ 2.5 s,
  off ≤ 0.4 s per event.
- Skip (button / Space) jumps the running timeline to its end (`progress(1)`) and presents everything queued
  instantly until a human decision is due. With autoplay or many bot turns the queue can get long in "full": that is
  expected, each action is staged in order.
- Layout rule for the 3D page: the bottom band belongs to the hand fan; HTML panels (prompt, log) stay above it so
  no card is ever under a panel. Hand cards keep a resting-size hit area, so the enlarged hovered card never swallows
  a click meant for its neighbour.

### 6.1 Sequence catalogue
| Events | Sequence (full) |
|---|---|
| `GAME_STARTED` | Drone shot over town at noon, bell tolls, pan across each seat with name + character title card. Sheriff pins star. |
| `TURN_STARTED` | Short focus on the active player, turn banner. |
| `DRAW_CHECK(dynamite)` | Close-up of lit fuse; card flip; success → toss Dynamite to next player (arc flight + `Throw`); explode → fireball, smoke, camera shake, `Death_*` or `HitReact`, scorch decal. |
| `DRAW_CHECK(jail)` + `JAIL_RESULT` | Player in jail cell; escaped → kicks door open, walks back; stay → sits dejected, turn skipped banner. |
| `CARD_PLAYED(bang)` + `SHOT` + response | Over-shoulder of shooter: `Draw` → `Aim` → `Shoot`, muzzle flash, tracer/bullet. Then: **Missed!** → target `Dodge` roll, bullet hits wall dust puff. **Barrel** → target `CoverCrouch` behind barrel, splinters. **Hit** → `HitReact`, blood-free dust/impact spark, life bullet pops off the HUD. Weapon model matches equipped card; Winchester/Carabine use `ShootRifle`. |
| `CARD_PLAYED(gatling)` | Gatling gun on a wagon rolls in; shooter cranks it, sweeping arc; each target reacts in order (dodge/cover/hit). |
| `CARD_PLAYED(indians)` | Riders gallop in from the desert edge in a dust storm (horse + rider models, bows, war cries sound), arrows streak at each player; each defends (fires a BANG! back: `Shoot`) or gets hit. Depict respectfully: no caricature or mockery; dress and design should feel like an authentic, dignified 19th-century raid party. |
| `CARD_PLAYED(duel)` + `DUEL_ROUND`s | Both walk to the main street, face each other 15 m apart, tumbleweed, wind, clock tower strikes noon, extreme close-ups of eyes and holster hands (Sergio Leone homage). Each round: quick-draw shot that misses (spark off ground). Loser: final shot, `HitReact`/`Death`. Return to seats. |
| `CARD_PLAYED(beer)` + `HEALED` | Player pulls a bottle, `Drink`, warm glow, life bullet returns. |
| `CARD_PLAYED(saloon)` | Cut to saloon interior: piano music, everyone alive raises a glass, everyone heals. |
| `CARD_PLAYED(stagecoach / wells_fargo)` | Stagecoach rattles into the square / bank vault opens; cards fly to the player. |
| `CARD_PLAYED(general_store)` + picks | Store counter shot; revealed cards laid on the counter; each pick animates the card to that player. |
| `CARD_PLAYED(panic)` + `CARD_STOLEN` | Player rushes the target, `Grab`, card flies over. |
| `CARD_PLAYED(cat_balou)` + `CARD_DISCARDED` | Lasso/whip `Lasso` snaps the card out of the target's hand/crate into the discard pile. |
| `EQUIPPED` | Character holsters old weapon, draws the new one with a spin; Mustang: horse trots in; Scope: spyglass check; Barrel: barrel rolls next to them. |
| `JAILED` | Deputy figure (generic townsperson) escorts the target to the jail; seat shows a jail-cell ghost. |
| `ELIMINATED` | Slow-motion fall (`Death_A/B`), hat rolls, role card flips face-up above them, undertaker places a coffin/gravestone at the seat. Vulture Sam: vulture shadow swoops, cards fly to him. |
| `REWARD(outlaw_bounty)` | "WANTED – Reward" poster tears off, 3 cards fly to the killer. |
| `GAME_OVER` | Winners together on main street at sunset; losers' gravestones; all roles revealed on cards; summary screen. |

## 7. Lighting, atmosphere & post-processing
- Directional sun (shadow-casting, tuned cascades or a single tight shadow camera over the square), HDRI sky for
  ambient/reflections, warm fog with distance.
- Particles: dust motes, wind-blown sand, tumbleweeds, muzzle smoke, explosion debris (instanced, pooled).
- Post: tone mapping (AgX/ACES), bloom (muzzle flashes, fuse sparks), SSAO (high+), vignette, subtle film grain,
  depth of field only in cinematics. Disable heavy passes on low/medium.

## 8. Quality presets
| Preset | Shadows | Post | Pixel ratio | Particles | LOD bias |
|---|---|---|---|---|---|
| low | off / blob shadows | none | 1.0 | 25% | aggressive |
| medium | 1024 | bloom, tone map | 1.25 | 50% | normal |
| high | 2048 | + SSAO, vignette | 1.5 | 100% | normal |
| ultra | 4096 | + DoF in cinematics, grain | device | 100% | quality |
`auto` picks via drei `PerformanceMonitor` / `AdaptiveDpr`, steps down when fps < 50 for 3 s.
Mobile forces `low` and uses tap-to-select instead of drag.

## 9. Performance budget (High preset, mid-range desktop GPU)
- 60 fps target in TABLE view, ≥ 45 fps in heavy cinematics.
- ≤ 400 draw calls in TABLE view (instancing for props, merged static town geometry).
- Characters: ≤ 25k tris each (LOD1 ~8k), textures ≤ 2K, shared material where possible.
- Initial download ≤ 25 MB to first playable (placeholders + town LOD); remaining assets stream in.

## 10. Audio
- Music: ambient western guitar loop in lobby/table, tension stinger on duel, saloon piano, victory theme.
- SFX: revolver/rifle shots per weapon, ricochet, barrel wood hit, horse gallop, arrows, war cry, explosion, fuse hiss,
  jail door, bottle clink, card swish/flip, bell toll, wind.
- 3D positional audio for world sounds, 2D for UI. Respect volume settings; start audio only after first user gesture.

**As built (Phase 12), all synthesised with the Web Audio API, no audio files** (`src/game3d/audio/`):
- `engine.ts`: one `AudioContext` created on the first click/key press, master → music/SFX gain buses (sliders are
  squared for a perceptual curve). World sounds go through an equal-power `PannerNode` at their position;
  `AudioLayer` (inside the Canvas) moves the listener with the camera each frame without allocating.
- `sfx.ts`: gunshot, rifle, ricochet, explosion, fuse, card swish, clink, bell, chime, gallop, whoosh (arrows,
  lasso), jail clank, thud (hit), wind. Small random detune per play.
- `music.ts`: a lookahead-scheduled fingerpicked loop (Am–G–F–E, 84 bpm) while the table is open, a horn stinger on
  Duel and a fanfare on game over.
- Sequences cue sounds through `VfxApi.sound(cue, at?)` (a zero-length timeline), so sounds follow the cinematic
  timing and speed; card flights and draw! reveals sound on their own. With cinematics off, card swishes and the
  game-over fanfare still play.
- Settings: master / music / effects in `settingsStore.volume` (defaults 80/50/80, persisted), in the table's
  "Suara" menu, next to the credits.
- Deliberately left out: the war cry (a caricature we do not want) and the saloon piano (Saloon uses the clink and
  the town loop).

## 11. Placeholders (build these first, Phase 7–8)
- Characters: capsule body + sphere head + cone hat, tinted per seat, with simple procedural "animations"
  (tween transforms: recoil, dodge sidestep, fall over). Weapon = box.
- Buildings: boxes with simple roofs placed per the map. Horses: stretched boxes. Barrel: cylinder.
- Cards: real card mesh with generated canvas textures (type name, color by brown/blue, suit/rank).
- Every placeholder registered in `AssetRegistry` with the same id as the real asset → swapping is data-only.
