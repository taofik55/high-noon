# High Noon

Private 3D Wild West adaptation of the Bang! base game, for personal play with friends.

- Project rules and stack: [CLAUDE.md](CLAUDE.md)
- Design docs: [docs/](docs/) (start with `docs/01-PRD.md`)
- Phase roadmap: [docs/08-ROADMAP-AND-PROMPTS.md](docs/08-ROADMAP-AND-PROMPTS.md)
- Panduan (Bahasa Indonesia): [PANDUAN.md](PANDUAN.md)

## Getting started

Requires Node 24+ and pnpm.

```bash
pnpm install
cp .env.example .env.local   # fill in later (Supabase from Phase 9)
pnpm dev                     # http://localhost:3000
```

## Local database (online features, from Phase 9)

Docker Desktop must be running. See [docs/SETUP-SUPABASE.md](docs/SETUP-SUPABASE.md).

```bash
pnpm db:start        # local Supabase on ports 553xx, applies supabase/migrations
pnpm test:db         # row-level security tests
```

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm exec playwright install chromium   # once, before the first e2e run
pnpm e2e
```
