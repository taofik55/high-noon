# 07 — Assets Guide (models, animations, card art, audio)

The code never depends on a specific asset existing: `src/game3d/assets/manifest.ts` lists every asset id with its path,
license and a placeholder fallback. Real files are dropped into `public/assets/` and the manifest updated.

> **Decision (Phase 12): all 3D assets are generated in code** (`src/game3d/procedural/`, docs/05 §1), so the
> sourcing and Blender/Mixamo pipeline below is no longer used for models and animations. Kept for reference (audio,
> optional imports later). The manifest/placeholder mechanism still applies. Workflow agreed with the owner: master
> cowboy, Colt .45 and saloon first, reviewed in `/dev/assets`, then the remaining assets.

## 1. Sources (check each license; keep `CREDITS.md` up to date)
| Need | Good sources | License notes |
|---|---|---|
| Rigged humanoids + animations | **Mixamo** (free with Adobe ID) | Free to use in projects; no redistribution of raw files as an asset pack. |
| Western props, buildings, horses | **Sketchfab** (filter: Downloadable + CC-BY/CC0), **Fab** (Epic marketplace), **itch.io** asset packs | CC-BY requires attribution in credits screen. |
| Textures & HDRI skies | **Poly Haven**, **ambientCG** | CC0. |
| Low-poly fallbacks | **Quaternius**, **Kenney** | CC0 (less realistic, good for far props). |
| Custom characters | AI 3D generators (e.g. Meshy, Tripo, Rodin) → clean up in Blender → auto-rig in Mixamo | Check each tool's output license / plan. |
| Card art & portraits | Your own illustrations or AI image tools in one consistent style | Do **not** use official Bang! art. |
| Music & SFX | **Pixabay** audio, **freesound.org** (CC0/CC-BY), **Sonniss GDC bundles** | Attribute CC-BY. |

## 2. Asset checklist
### 2.1 Characters (16) — `public/assets/characters/<id>.glb`
Strategy to stay sane: 4–6 base bodies (lean, stocky, tall, woman ×2, older man) with different outfits/hats/colors.
Each character needs: Mixamo-compatible skeleton, ≤ 25k tris, one 2K texture set, a signature prop.
| id | Visual idea |
|---|---|
| bart_cassidy | young ranch hand, rolled sleeves, playing cards in vest |
| black_jack | gambler, black suit, card-suit embroidered vest |
| calamity_janet | buckskin jacket, twin revolvers |
| el_gringo | poncho, sombrero, scarred face |
| jesse_jones | bandana mask, long coat |
| jourdonnais | French gentleman, top hat, cane |
| kit_carlson | scout, fringe jacket, telescope |
| lucky_duke | flashy dandy, horseshoe pin, lucky coin |
| paul_regret | rider, chaps, always near horse |
| pedro_ramirez | vaquero, ornate saddlebags |
| rose_doolan | sharpshooter, rifle with scope, red scarf |
| sid_ketchum | grizzled drinker, flask, bandages |
| slab_the_killer | huge bounty hunter, double holster |
| suzy_lafayette | saloon singer, feathered hat, derringer |
| vulture_sam | gaunt undertaker look, black coat, vulture feather |
| willy_the_kid | teenage gunslinger, oversized hat |

### 2.2 Animations — single shared file `public/assets/anims/shared.glb`
Download from Mixamo "without skin", same skeleton, rename clips to the names in docs/05 §5, combine in Blender into one
GLB (or load several GLBs and merge clips at runtime). Needed: Idle, IdleArmed, Draw, Aim, Shoot, ShootRifle, HitReact,
Dodge, CoverCrouch, Death_A, Death_B, Drink, Cheer, Walk, Run, Throw, Grab, Lasso (or "Throw" variant), SitJail (sitting),
Taunt, Shrug, Fidget (revolver spin / hat tip).
Horse animations (Idle, Walk, Gallop) come with the horse model (Mixamo has no horses); rider uses a sitting/riding pose.

### 2.3 Weapons & props
Colt .45, Volcanic (lever pistol), Schofield, Remington, Rev. Carabine (carbine), Winchester (rifle), Gatling gun on
wagon, dynamite stick + bundle, barrel, beer bottle, whiskey glass, spyglass/scope, lasso/whip, playing-card table/crate,
coffin, gravestone, wanted poster, star badge, jail chains, stagecoach, horse (×2–3 variations), bow & arrows.

### 2.4 Town set
Saloon (exterior + simple interior), sheriff's office with jail cell, bank, general store, undertaker, stable, water tower,
stagecoach stop, wooden sidewalks, hitching posts, crates, hay bales, cacti, rocks, tumbleweed, mesa backdrop,
ground textures (sand, dirt road), HDRI sky (late afternoon / sunset).

### 2.5 Cards — `public/assets/cards/`
> **As built (Phase 12):** card art is procedural too. `src/game3d/cards/cardArt.ts` renders one scene per card type
> offscreen from the procedural characters, weapons and props and finishes it as a sepia engraving; `cardTexture.ts`
> draws the frame, title, index and rules. Review them at `/dev/cards`. Role cards and portraits remain future work.

- 22 card-type illustrations (one per type; copies share art), 1 card back, 4 role cards, 16 character portraits.
- Format: 768×1072 WebP (or KTX2), text rendered by code on top (name, rules icon, suit/rank) so art stays text-free.
- Keep a consistent style prompt if using AI images, e.g. "vintage western engraving, sepia ink, warm parchment".

### 2.6 Audio — `public/assets/audio/`
> **As built (Phase 12):** no audio files; every effect and the music are synthesised at runtime (docs/05 §10).

See docs/05 §10. OGG/MP3, normalized to −16 LUFS (music) / −12 LUFS (SFX peaks).

## 3. Pipeline
1. Blender: clean mesh, apply transforms, scale (1 unit = 1 m), Y-up on export, name the right-hand bone attachment
   (`mixamorig:RightHand`), export glTF Binary (.glb).
2. Optimize:
   ```bash
   npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress webp --texture-size 2048
   ```
   (Use KTX2 via `toktx` later if GPU memory becomes an issue.)
3. Generate typed components (optional): `npx gltfjsx out.glb --types --transform`.
4. Add to `manifest.ts` with license + credit string. Test in the dev `/dev/assets` viewer route (Phase 12) that shows
   each asset, its clips and triangle count.

## 4. Manifest shape
```ts
export const ASSETS = {
  'char.bart_cassidy': { url: '/assets/characters/bart_cassidy.glb', kind: 'character', fallback: 'placeholder.capsule', credit: '…' },
  'anim.shared':       { url: '/assets/anims/shared.glb', kind: 'animations' },
  'prop.barrel':       { url: '/assets/props/barrel.glb', kind: 'prop', fallback: 'placeholder.cylinder' },
  // …
} as const satisfies Record<string, AssetEntry>
```

## 5. Things only the owner can do
- Create Adobe (Mixamo), Sketchfab/Fab accounts and download assets.
- Decide the visual style and generate/commission card art.
- Run Blender cleanup if a model is broken (Claude Code can write Blender Python scripts to batch-fix, rename clips,
  merge animations — ask it).
