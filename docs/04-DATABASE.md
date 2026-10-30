# 04 — Database (Supabase)

## 1. Principles
- Clients **read** through RLS; clients **never write** game or room tables directly. All writes go through Next.js route
  handlers with the secret (service role) key after authorization checks.
- The full secret game state lives only in `games.state`, which has **no** client policies.
- Each human gets one `player_views` row per game (their redacted view). Realtime on that table is the "something
  changed" signal; events are fetched by query.
- Auth: **Anonymous sign-ins enabled**. Google provider enabled + **manual identity linking enabled** so an anonymous user
  can `linkIdentity({ provider: 'google' })` and keep the same `user.id`.

## 2. Supabase dashboard setup (owner does this once)
1. Create project (region closest to players, e.g. Singapore).
2. Authentication → Sign In / Providers: enable **Anonymous**, enable **Google** (OAuth client from Google Cloud
   Console, redirect URL from Supabase), enable **Manual linking**.
3. Authentication → URL configuration: Site URL = Vercel production URL; add `http://localhost:3000/**` and the Vercel
   preview pattern to redirect URLs.
4. Optional: enable CAPTCHA/Turnstile for anonymous sign-ins if abuse ever appears.
5. Get Project URL, publishable (anon) key, secret (service role) key → Vercel env vars.

## 3. Migration `0001_init.sql`

```sql
-- ===== Types =====
create type public.room_status as enum ('lobby', 'in_game', 'finished', 'closed');
create type public.npc_difficulty as enum ('easy', 'medium', 'hard');

-- ===== Profiles =====
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 2 and 20),
  avatar_key    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
             'Koboi-' || substr(new.id::text, 1, 4))
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== Rooms =====
create table public.rooms (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),  -- no I, O, 0, 1
  host_id          uuid not null references auth.users(id),
  status           public.room_status not null default 'lobby',
  settings         jsonb not null default '{}'::jsonb,
  current_game_id  uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.room_players (
  room_id         uuid not null references public.rooms(id) on delete cascade,
  slot            smallint not null check (slot between 0 and 6),
  user_id         uuid references auth.users(id) on delete cascade,
  is_npc          boolean not null default false,
  npc_difficulty  public.npc_difficulty,
  display_name    text not null,
  is_ready        boolean not null default false,
  joined_at       timestamptz not null default now(),
  primary key (room_id, slot),
  unique (room_id, user_id),
  check ((is_npc and user_id is null and npc_difficulty is not null)
      or (not is_npc and user_id is not null))
);

-- ===== Games =====
create table public.games (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid not null references public.rooms(id) on delete cascade,
  version          integer not null default 0,
  state            jsonb not null,             -- FULL SECRET STATE. Never exposed to clients.
  status           text not null default 'active' check (status in ('active', 'finished', 'aborted')),
  winner           text check (winner in ('sheriff_team', 'outlaws', 'renegade')),
  prompt_deadline  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.rooms
  add constraint rooms_current_game_fk
  foreign key (current_game_id) references public.games(id) on delete set null;

create table public.game_seats (
  game_id         uuid not null references public.games(id) on delete cascade,
  seat            smallint not null check (seat between 0 and 6),
  user_id         uuid references auth.users(id) on delete set null,
  is_npc          boolean not null default false,
  npc_difficulty  public.npc_difficulty,
  display_name    text not null,
  timeouts        smallint not null default 0,      -- consecutive timeouts
  afk_takeover    boolean not null default false,   -- NPC plays for this human until they act
  primary key (game_id, seat),
  unique (game_id, user_id)
);

create table public.player_views (
  game_id     uuid not null references public.games(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  seat        smallint not null,
  version     integer not null,
  view        jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (game_id, user_id)
);

create table public.game_events (
  id                 bigint generated always as identity primary key,
  game_id            uuid not null references public.games(id) on delete cascade,
  version            integer not null,      -- game version produced by the commit
  seq                integer not null,      -- order inside the commit
  recipient_user_id  uuid references auth.users(id) on delete cascade, -- null = public to game members
  payload            jsonb not null,
  created_at         timestamptz not null default now()
);
create index game_events_lookup on public.game_events (game_id, version, seq);

-- ===== Stats (P2) =====
create table public.player_stats (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  games_played  integer not null default 0,
  wins          integer not null default 0,
  wins_by_role  jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now()
);

-- ===== Membership helpers (security definer to avoid RLS recursion) =====
create or replace function public.is_room_member(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.room_players where room_id = p_room and user_id = auth.uid());
$$;

create or replace function public.is_game_member(p_game uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.game_seats where game_id = p_game and user_id = auth.uid());
$$;

-- ===== RLS =====
alter table public.profiles      enable row level security;
alter table public.rooms         enable row level security;
alter table public.room_players  enable row level security;
alter table public.games         enable row level security;   -- no policies on purpose
alter table public.game_seats    enable row level security;
alter table public.player_views  enable row level security;
alter table public.game_events   enable row level security;
alter table public.player_stats  enable row level security;

create policy profiles_read   on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy rooms_read        on public.rooms        for select to authenticated using (public.is_room_member(id));
create policy room_players_read on public.room_players for select to authenticated using (public.is_room_member(room_id));
create policy game_seats_read   on public.game_seats   for select to authenticated using (public.is_game_member(game_id));
create policy player_views_read on public.player_views for select to authenticated using (user_id = auth.uid());
create policy game_events_read  on public.game_events  for select to authenticated
  using (public.is_game_member(game_id) and (recipient_user_id is null or recipient_user_id = auth.uid()));
create policy player_stats_read on public.player_stats for select to authenticated using (true);

-- ===== Atomic commit (server only) =====
create or replace function public.commit_game_action(
  p_game_id          uuid,
  p_expected_version integer,
  p_state            jsonb,
  p_status           text,
  p_winner           text,
  p_prompt_deadline  timestamptz,
  p_views            jsonb,   -- [{ "user_id": uuid, "seat": int, "view": {...} }]
  p_events           jsonb,   -- [{ "seq": int, "recipient_user_id": uuid|null, "payload": {...} }]
  p_seat_updates     jsonb    -- [{ "seat": int, "timeouts": int, "afk_takeover": bool }]
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_new integer;
begin
  update public.games
     set state = p_state,
         version = version + 1,
         status = p_status,
         winner = p_winner,
         prompt_deadline = p_prompt_deadline,
         updated_at = now()
   where id = p_game_id and version = p_expected_version
  returning version into v_new;

  if v_new is null then
    raise exception 'VERSION_CONFLICT' using errcode = 'P0001';
  end if;

  update public.game_seats gs
     set timeouts = (u->>'timeouts')::smallint,
         afk_takeover = (u->>'afk_takeover')::boolean
    from jsonb_array_elements(coalesce(p_seat_updates, '[]'::jsonb)) u
   where gs.game_id = p_game_id and gs.seat = (u->>'seat')::smallint;

  insert into public.game_events (game_id, version, seq, recipient_user_id, payload)
  select p_game_id, v_new, (e->>'seq')::int, nullif(e->>'recipient_user_id', '')::uuid, e->'payload'
    from jsonb_array_elements(p_events) e;

  -- views last, so a client reacting to the view change can already read the events
  insert into public.player_views (game_id, user_id, seat, version, view, updated_at)
  select p_game_id, (v->>'user_id')::uuid, (v->>'seat')::smallint, v_new, v->'view', now()
    from jsonb_array_elements(p_views) v
  on conflict (game_id, user_id)
  do update set version = excluded.version, view = excluded.view, seat = excluded.seat, updated_at = now();

  return v_new;
end $$;

revoke all on function public.commit_game_action(uuid, integer, jsonb, text, text, timestamptz, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.commit_game_action(uuid, integer, jsonb, text, text, timestamptz, jsonb, jsonb, jsonb)
  to service_role;

-- ===== Realtime =====
alter publication supabase_realtime add table public.player_views, public.room_players, public.rooms;
```

> All statements run in one transaction per RPC call, so events and views appear atomically to readers.

## 4. Migration `0002_housekeeping.sql` (optional)
```sql
-- Close lobbies idle > 6h and delete finished rooms > 7 days. Requires pg_cron extension (enable in dashboard).
create extension if not exists pg_cron;
select cron.schedule('room-cleanup', '17 * * * *', $$
  update public.rooms set status = 'closed' where status = 'lobby' and updated_at < now() - interval '6 hours';
  delete from public.rooms where status in ('finished','closed') and updated_at < now() - interval '7 days';
$$);
```

## 5. Room settings JSON (`rooms.settings`)
```jsonc
{
  "turnTimerSec": 60,          // 0 = off
  "characterMode": "random",   // "random" | "choose_of_2"
  "afkTakeoverAfter": 2,
  "defaultNpcDifficulty": "medium"
}
```

## 6. Payload sizes
A full state is ~15–25 KB JSON, a view ~3–6 KB. Fine for Postgres jsonb and Realtime payload limits. If a view ever
grows past ~200 KB, switch to sending only a version bump and fetching the view.

## 7. Type generation
After each migration: `supabase gen types typescript --local > src/lib/supabase/types.ts`. Never hand-edit.

## 8. Local development
`supabase start` (Docker), `supabase db reset` applies migrations + `supabase/seed.sql` (can be empty). Use local URL and
keys in `.env.local`. Anonymous sign-in must also be enabled in `supabase/config.toml` (`[auth] enable_anonymous_sign_ins = true`,
`[auth] enable_manual_linking = true`).
