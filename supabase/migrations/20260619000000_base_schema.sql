-- Base schema for ARCA.
--
-- The incremental migrations that follow this file (collection covers, safe
-- deletion, card intelligence archive, front/back images) assume the core
-- tables, storage bucket, and row level security policies below already exist.
-- That base schema was originally provisioned directly in the hosted Supabase
-- project and never committed, so this migration reconstructs it idempotently
-- to make local (and any fresh) Supabase environments work end to end.
--
-- Everything here uses "if not exists" / "drop ... if exists" so it is safe to
-- run against an environment that already has the base objects.

-- Profiles ------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  display_name text,
  bio text,
  rank text default 'I',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Collections ---------------------------------------------------------------
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text,
  visibility text default 'private',
  description text,
  created_at timestamptz not null default now()
);

create index if not exists collections_owner_id_idx on public.collections (owner_id);

alter table public.collections enable row level security;

drop policy if exists "Users can read their own collections" on public.collections;
create policy "Users can read their own collections"
on public.collections for select
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "Users can insert their own collections" on public.collections;
create policy "Users can insert their own collections"
on public.collections for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can update their own collections" on public.collections;
create policy "Users can update their own collections"
on public.collections for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

-- Dropped later by 20260621160000_safe_collection_deletion.sql, which replaces
-- it with "Owners can delete their collections".
drop policy if exists "Users can delete their own collections" on public.collections;
create policy "Users can delete their own collections"
on public.collections for delete
to authenticated
using ((select auth.uid()) = owner_id);

-- Cards ---------------------------------------------------------------------
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  collection_id uuid references public.collections (id) on delete set null,
  player_name text not null,
  sport text,
  year integer,
  brand text,
  set_name text,
  card_number text,
  grader text,
  grade text,
  estimated_value numeric,
  status text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists cards_owner_id_idx on public.cards (owner_id);
create index if not exists cards_collection_id_idx on public.cards (collection_id);

alter table public.cards enable row level security;

drop policy if exists "Users can read their own cards" on public.cards;
create policy "Users can read their own cards"
on public.cards for select
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "Users can insert their own cards" on public.cards;
create policy "Users can insert their own cards"
on public.cards for insert
to authenticated
with check ((select auth.uid()) = owner_id);

-- Dropped later by 20260621184500_consolidate_card_management_policies.sql,
-- which keeps the stricter "Owners can update their cards" from the safe
-- deletion migration.
drop policy if exists "Users can update their own cards" on public.cards;
create policy "Users can update their own cards"
on public.cards for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can delete their own cards" on public.cards;
create policy "Users can delete their own cards"
on public.cards for delete
to authenticated
using ((select auth.uid()) = owner_id);

-- Card images ---------------------------------------------------------------
create table if not exists public.card_images (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  image_url text not null,
  image_type text,
  created_at timestamptz not null default now()
);

create index if not exists card_images_card_id_base_idx on public.card_images (card_id);

alter table public.card_images enable row level security;

drop policy if exists "Owners can read their card images" on public.card_images;
create policy "Owners can read their card images"
on public.card_images for select
to authenticated
using (
  exists (
    select 1 from public.cards
    where cards.id = card_images.card_id
      and cards.owner_id = (select auth.uid())
  )
);

drop policy if exists "Owners can insert their card images" on public.card_images;
create policy "Owners can insert their card images"
on public.card_images for insert
to authenticated
with check (
  exists (
    select 1 from public.cards
    where cards.id = card_images.card_id
      and cards.owner_id = (select auth.uid())
  )
);

drop policy if exists "Owners can delete their card images" on public.card_images;
create policy "Owners can delete their card images"
on public.card_images for delete
to authenticated
using (
  exists (
    select 1 from public.cards
    where cards.id = card_images.card_id
      and cards.owner_id = (select auth.uid())
  )
);

-- Storage: card_images bucket -----------------------------------------------
insert into storage.buckets (id, name, public)
values ('card_images', 'card_images', true)
on conflict (id) do update set public = true;

drop policy if exists "Authenticated users can upload card images" on storage.objects;
create policy "Authenticated users can upload card images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'card_images');

drop policy if exists "Anyone can read card images" on storage.objects;
create policy "Anyone can read card images"
on storage.objects for select
using (bucket_id = 'card_images');
