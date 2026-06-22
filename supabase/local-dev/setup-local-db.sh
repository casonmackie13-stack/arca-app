#!/usr/bin/env bash
#
# Provision the LOCAL Supabase stack for ARCA development.
#
# Why this script exists
# ----------------------
# The production migrations in supabase/migrations/ assume a base schema
# (profiles, collections, cards, card_images + the card_images storage bucket +
# RLS policies) that was originally created by hand in the hosted Supabase
# project and is intentionally NOT committed as a migration. The local-only
# reconstruction lives in supabase/local-dev/base_schema.sql.
#
# Because the production migrations must run AFTER that base schema, and the
# Supabase CLI applies every file in supabase/migrations/ automatically (in
# filename order) when the stack starts, this script temporarily stages
# base_schema.sql as the first migration, starts the stack (which applies the
# base schema and then the production migrations, in order), and finally
# removes the staged copy so it can never reach production via `supabase db push`.
#
# Usage
# -----
#   supabase/local-dev/setup-local-db.sh          # provision / re-provision
#
# This performs a CLEAN provision: it wipes any existing local Supabase data
# (supabase stop --no-backup) and rebuilds from base_schema.sql + the production
# migrations. After it finishes, `supabase start` / `supabase stop` work as
# usual and your data persists between them. Re-run this script whenever you
# want a fresh database (it is the local equivalent of `supabase db reset`,
# which cannot be used directly here because it only knows the production
# migrations and would fail without the base schema).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

STAGED="supabase/migrations/20260619000000_local_base_schema.sql"

cleanup() { rm -f "$STAGED"; }
trap cleanup EXIT

echo "==> Wiping any existing local Supabase data"
supabase stop --no-backup >/dev/null 2>&1 || true

echo "==> Staging local base schema as the first migration"
cp supabase/local-dev/base_schema.sql "$STAGED"

echo "==> Starting local Supabase (applies base schema, then production migrations)"
supabase start

echo "==> Unstaging local base schema (kept out of supabase/migrations/)"
cleanup
trap - EXIT

echo
echo "Local Supabase is ready. Run 'supabase status' to see the API URL and anon key."
echo "Make sure .env.local contains NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY,"
echo "then start the app with 'npm run dev'."
