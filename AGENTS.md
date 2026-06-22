# AGENTS.md

## Cursor Cloud specific instructions

ARCA is a Next.js 16 (App Router, React 19) trading-card collection app backed by Supabase
(Postgres + Auth + Storage). All data access goes through the browser Supabase client in
`lib/supabase.ts`; there is no separate backend service.

### Services and how to run them

- **Next.js dev server** — `npm run dev` (serves on `0.0.0.0:3000`, uses webpack per `package.json`).
  Lint: `npm run lint`. Production build: `npm run build` (uses Turbopack).
- **Supabase local stack** — provides the Postgres DB, Auth (GoTrue), Storage, REST, and Studio
  that the app talks to. Started with `supabase start` (see startup notes below). Inspect with
  `supabase status`; reach REST at `http://127.0.0.1:54321`.

### Required environment variables (`.env.local`, git-ignored)

The app reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and optionally
`OPENAI_API_KEY` / `OPENAI_VISION_MODEL` for the AI card-autofill API route). For local Supabase,
point these at the local stack — get the URL/anon key from `supabase status`. `.env.local` lives
on the VM disk (not committed), so it persists across sessions once created.

### Startup notes (non-obvious)

- **Docker is required** for the Supabase stack and is installed at the system level (not via the
  update script). The Docker daemon must be running before `supabase start`: launch `sudo dockerd`
  (e.g. in a tmux session) if `docker ps` fails. Docker uses the `fuse-overlayfs` storage driver
  with `containerd-snapshotter` disabled (see `/etc/docker/daemon.json`) and iptables-legacy — this
  is required for Docker-in-Firecracker here.
- The `supabase` CLI is a shim that requires its co-located `supabase-go` binary; both live in
  `/usr/local/bin`.
- `supabase start` binds services to `0.0.0.0`; ports: API 54321, DB 54322, Studio 54323, Mailpit 54324.

### KNOWN ISSUE — base database schema is missing from the repo

`supabase/migrations/` only contains **incremental** changes. The base tables the app depends on —
`profiles`, `collections`, `cards`, `card_images` — are **never created** by any committed
migration (only `card_training_events` is created, in `20260622190000_*.sql`). As a result
`supabase db reset` / `supabase migration up` fails on the first migration with:

```
ERROR: relation "public.collections" does not exist (SQLSTATE 42P01)
```

Consequences: a fresh local Supabase DB has **no app tables and no storage buckets**
(`collection_covers`, `card_images`, `card_training_images` are created inside the later
migrations). The Next.js app boots and all routes render, but any data read/write will fail until
the base schema exists. To get a fully working backend, supply the missing base-schema migration
(define `profiles`, `collections`, `cards`, `card_images` + their RLS policies and the `card_images`
bucket) or point `.env.local` at a remote Supabase project that already has the schema. Do not
fabricate this schema without confirmation — it changes app behavior.
