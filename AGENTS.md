# AGENTS.md

## Cursor Cloud specific instructions

ARCA is a single Next.js 16 app (App Router, TypeScript, Tailwind v4) backed by
Supabase (Postgres + Auth + Storage). There is no separate backend service — the
Next.js app contains both the UI and the API routes under `app/api`.

### Services

| Service | Purpose | How to run |
| --- | --- | --- |
| Next.js dev server | The whole app (UI + API routes), port 3000 | `npm run dev` (see `package.json`) |
| Local Supabase stack | Postgres + Auth + Storage the app depends on | Provisioned via `supabase/local-dev/setup-local-db.sh`, then managed with `supabase start` / `supabase stop` |

Lint / build use the standard scripts in `package.json` (`npm run lint`, `npm run build`).

### Local Supabase: required and non-obvious

- The app does not work without Supabase: unauthenticated users are redirected to
  `/auth`, and all data lives in Supabase tables/buckets.
- **The base schema is not a migration.** The migrations in `supabase/migrations/`
  are incremental and assume base tables (`profiles`, `collections`, `cards`,
  `card_images`), the public `card_images` storage bucket, and base RLS policies
  already exist. Those were created by hand in the hosted project and are *not*
  committed as a migration. A local-only reconstruction lives in
  `supabase/local-dev/base_schema.sql` and must be applied **before** the
  production migrations.
- Provision (or re-provision) the local database with
  `supabase/local-dev/setup-local-db.sh` — it applies the base schema first, then
  the production migrations. See `supabase/local-dev/README.md` for details.
- **Do not run `supabase db reset`**: it only knows the production migrations and
  fails without the base schema (`relation "public.collections" does not exist`).
  Re-run `setup-local-db.sh` instead to get a fresh database.
- After provisioning, create `.env.local` at the repo root with
  `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from \`supabase status\`>`. The local
  anon key is deterministic, so it is stable across restarts. `.env.local` is
  gitignored. Changing `.env.local` requires restarting `npm run dev`.
- `OPENAI_API_KEY` is optional: it only powers AI card-scan autofill
  (`/api/card-autofill`), which returns a graceful 503 when unset. The rest of the
  app (auth, collections, manual card entry, browsing) works without it.

### Environment startup (Cursor Cloud)

The Docker daemon and the local Supabase stack are not started by the update
script. In a fresh session, start Docker (`sudo dockerd`), then run
`supabase/local-dev/setup-local-db.sh` to bring up Supabase, then `npm run dev`.
