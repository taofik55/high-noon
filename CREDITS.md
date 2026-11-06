# Credits — High Noon

A private project for playing with friends. Not affiliated with, endorsed by, or sold with the official game.

## Game rules
Rules adapted from **Bang!** by Emiliano Sciarra, published by dV Giochi. No official artwork, logos or text from the
published game are used; card names are kept for recognisability.

## Art, models, animation
Everything visual is generated in code at runtime (three.js): characters, skeleton and animation clips, weapons,
buildings, props, horses, and the card illustrations (`src/game3d/procedural/`, `src/game3d/cards/cardArt.ts`).
No third-party models, textures or images.

## Sound and music
All sound effects and music are synthesised at runtime with the Web Audio API (`src/game3d/audio/`). No recordings or
samples.

## Software
Next.js, React, React Three Fiber, drei, three.js, GSAP, Zustand, Supabase, Tailwind CSS, zod, Vitest, Playwright —
each under its own open-source license (see `package.json` and `node_modules/*/LICENSE`).

If you add an outside asset later, list it here with its author, source URL and license (docs/07 §1), and add it to
the in-game credits (`src/ui/credits/Credits.tsx`, strings in `src/ui/i18n`).
