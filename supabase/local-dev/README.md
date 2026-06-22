# Local development database (local-only, never pushed to production)

The production migrations in [`../migrations/`](../migrations) assume a base schema
already exists: the `profiles`, `collections`, `cards`, and `card_images` tables,
the public `card_images` storage bucket, and their row level security policies.
That base schema was originally created by hand in the hosted Supabase project and
was never committed as a migration, so the migrations in `../migrations/` cannot be
applied to a fresh database on their own — the first one (`add_collection_cover_images`)
immediately does `alter table public.collections ...` and fails with
`relation "public.collections" does not exist`.

This folder reconstructs that base schema **for local development only**:

- [`base_schema.sql`](./base_schema.sql) — idempotent SQL that creates the base
  tables, the `card_images` bucket, and the base RLS policies. It is deliberately
  **not** a file in `supabase/migrations/`, so `supabase db push` can never send it
  to the hosted/production database.
- [`setup-local-db.sh`](./setup-local-db.sh) — provisions a fresh local stack by
  applying `base_schema.sql` **before** the production migrations.

## Apply it locally

Prerequisites: Docker running, and the Supabase CLI installed.

```bash
# From the repository root:
supabase/local-dev/setup-local-db.sh
```

This wipes any existing local Supabase data, then starts the stack and applies the
base schema followed by the production migrations, in the correct order. Under the
hood it temporarily copies `base_schema.sql` into `supabase/migrations/` as the
first migration, runs `supabase start`, and then removes the staged copy — so the
base schema is applied locally but is never tracked as a migration.

After it finishes:

```bash
supabase status   # shows API URL + anon key
```

Put those into `.env.local` at the repo root:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from `supabase status`>
```

Then run the app with `npm run dev` (http://localhost:3000).

## Notes / gotchas

- `supabase start` and `supabase stop` work normally afterward and your data
  persists between them.
- **Do not run `supabase db reset` directly.** It only knows the production
  migrations and will fail without the base schema. To get a fresh database,
  re-run `setup-local-db.sh` (it is the local equivalent of a reset).
- The base schema is applied to the hosted project out of band (it already exists
  there), so nothing in this folder should ever be pushed.
