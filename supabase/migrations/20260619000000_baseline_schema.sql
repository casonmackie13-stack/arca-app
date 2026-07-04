-- ARCA baseline schema.
-- This migration is intentionally idempotent so it can bootstrap fresh
-- Supabase projects while coexisting with the later hardening migrations.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text not null,
  bio text,
  rank text not null default 'I',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_length check (char_length(username) between 3 and 30),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]+$'),
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 60),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 280)
);

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username));

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null default 'Other',
  visibility text not null default 'private',
  description text,
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collections_name_length check (char_length(name) between 1 and 120),
  constraint collections_visibility_check check (visibility in ('private', 'public'))
);

create unique index if not exists collections_one_unsorted_per_owner
  on public.collections (owner_id)
  where lower(name) = 'unsorted';

create index if not exists collections_owner_created_idx
  on public.collections (owner_id, created_at desc);

create index if not exists collections_visibility_created_idx
  on public.collections (visibility, created_at desc);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  collection_id uuid references public.collections(id) on delete set null,
  player_name text not null,
  sport text,
  year integer,
  brand text,
  set_name text,
  card_number text,
  team text,
  parallel text,
  rookie_card boolean,
  serial_number text,
  condition text,
  grader text not null default 'Raw',
  grade text not null default 'Raw',
  estimated_value numeric,
  status text not null default 'personal_collection',
  notes text,
  original_image_url text,
  front_image_url text,
  back_image_url text,
  original_front_image_url text,
  original_back_image_url text,
  display_image_url text,
  image_source text,
  image_source_url text,
  image_replacement_status text not null default 'original',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cards_player_name_length check (char_length(player_name) between 1 and 160),
  constraint cards_year_check check (year is null or year between 1800 and 2200),
  constraint cards_estimated_value_check check (estimated_value is null or estimated_value >= 0),
  constraint cards_status_check check (status in ('personal_collection', 'for_sale', 'for_trade', 'wishlist', 'watchlist', 'sold'))
);

create index if not exists cards_owner_created_idx
  on public.cards (owner_id, created_at desc);

create index if not exists cards_collection_created_idx
  on public.cards (collection_id, created_at desc);

create table if not exists public.card_images (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  image_url text not null,
  image_type text not null default 'front',
  created_at timestamptz not null default now(),
  constraint card_images_type_check check (image_type in ('front', 'back', 'detail', 'other'))
);

create unique index if not exists card_images_one_front_back_per_card_idx
  on public.card_images (card_id, image_type)
  where image_type in ('front', 'back');

create index if not exists card_images_card_id_idx
  on public.card_images (card_id);

create table if not exists public.card_training_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid references public.cards(id) on delete set null,
  original_image_path text,
  original_image_url text,
  original_front_image_path text,
  original_back_image_path text,
  original_front_image_url text,
  original_back_image_url text,
  display_image_url text,
  ai_extracted_json jsonb not null default '{}'::jsonb,
  user_corrected_json jsonb not null default '{}'::jsonb,
  field_feedback_json jsonb not null default '{}'::jsonb,
  sales_query text,
  sales_results_json jsonb not null default '[]'::jsonb,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  source text not null default 'manual',
  training_eligible boolean not null default false,
  consented_at timestamptz,
  archive_status text not null default 'captured',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists card_training_events_user_created_idx
  on public.card_training_events (user_id, created_at desc);

create index if not exists card_training_events_card_idx
  on public.card_training_events (card_id);

create table if not exists public.user_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_follows_no_self_follow check (follower_id <> following_id),
  constraint user_follows_unique unique (follower_id, following_id)
);

create index if not exists user_follows_follower_idx
  on public.user_follows (follower_id);

create index if not exists user_follows_following_idx
  on public.user_follows (following_id);

alter table public.profiles enable row level security;
alter table public.collections enable row level security;
alter table public.cards enable row level security;
alter table public.card_images enable row level security;
alter table public.card_training_events enable row level security;
alter table public.user_follows enable row level security;

revoke all on public.profiles from public, anon;
revoke all on public.collections from public, anon;
revoke all on public.cards from public, anon;
revoke all on public.card_images from public, anon;
revoke all on public.card_training_events from public, anon;
revoke all on public.user_follows from public, anon;

grant select on public.profiles, public.collections, public.cards, public.card_images, public.user_follows to anon;
grant select, insert, update, delete on public.profiles, public.collections, public.cards, public.card_images, public.card_training_events, public.user_follows to authenticated;

drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable"
on public.profiles for select
to anon, authenticated
using (true);

drop policy if exists "Users can create own profile" on public.profiles;
create policy "Users can create own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Owners can create collections" on public.collections;
create policy "Owners can create collections"
on public.collections for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "Anyone can read public collections" on public.collections;
create policy "Anyone can read public collections"
on public.collections for select
to anon, authenticated
using (visibility = 'public' or owner_id = (select auth.uid()));

drop policy if exists "Owners can update their collections" on public.collections;
create policy "Owners can update their collections"
on public.collections for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "Owners can delete their collections" on public.collections;
create policy "Owners can delete their collections"
on public.collections for delete
to authenticated
using ((select auth.uid()) = owner_id and lower(name) <> 'unsorted');

drop policy if exists "Owners can create cards in their collections" on public.cards;
create policy "Owners can create cards in their collections"
on public.cards for insert
to authenticated
with check (
  (select auth.uid()) = owner_id
  and (
    collection_id is null
    or exists (
      select 1
      from public.collections
      where collections.id = cards.collection_id
        and collections.owner_id = (select auth.uid())
    )
  )
);

drop policy if exists "Anyone can read public cards" on public.cards;
create policy "Anyone can read public cards"
on public.cards for select
to anon, authenticated
using (
  owner_id = (select auth.uid())
  or exists (
    select 1
    from public.collections c
    where c.id = cards.collection_id
      and c.visibility = 'public'
  )
);

drop policy if exists "Owners can update their cards" on public.cards;
create policy "Owners can update their cards"
on public.cards for update
to authenticated
using ((select auth.uid()) = owner_id)
with check (
  (select auth.uid()) = owner_id
  and (
    collection_id is null
    or exists (
      select 1
      from public.collections
      where collections.id = cards.collection_id
        and collections.owner_id = (select auth.uid())
    )
  )
);

drop policy if exists "Owners can delete their cards" on public.cards;
create policy "Owners can delete their cards"
on public.cards for delete
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "Owners can create card images" on public.card_images;
create policy "Owners can create card images"
on public.card_images for insert
to authenticated
with check (
  exists (
    select 1
    from public.cards
    where cards.id = card_images.card_id
      and cards.owner_id = (select auth.uid())
  )
);

drop policy if exists "Anyone can read images for readable cards" on public.card_images;
create policy "Anyone can read images for readable cards"
on public.card_images for select
to anon, authenticated
using (
  exists (
    select 1
    from public.cards
    where cards.id = card_images.card_id
      and (
        cards.owner_id = (select auth.uid())
        or exists (
          select 1
          from public.collections c
          where c.id = cards.collection_id
            and c.visibility = 'public'
        )
      )
  )
);

drop policy if exists "Owners can update their card images" on public.card_images;
create policy "Owners can update their card images"
on public.card_images for update
to authenticated
using (
  exists (
    select 1
    from public.cards
    where cards.id = card_images.card_id
      and cards.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.cards
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
    select 1
    from public.cards
    where cards.id = card_images.card_id
      and cards.owner_id = (select auth.uid())
  )
);

drop policy if exists "Owners read card training events" on public.card_training_events;
create policy "Owners read card training events"
on public.card_training_events for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Owners create card training events" on public.card_training_events;
create policy "Owners create card training events"
on public.card_training_events for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Owners update card training events" on public.card_training_events;
create policy "Owners update card training events"
on public.card_training_events for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Owners delete card training events" on public.card_training_events;
create policy "Owners delete card training events"
on public.card_training_events for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Anyone can read follow relationships" on public.user_follows;
create policy "Anyone can read follow relationships"
on public.user_follows for select
to anon, authenticated
using (true);

drop policy if exists "Users can follow as themselves" on public.user_follows;
create policy "Users can follow as themselves"
on public.user_follows for insert
to authenticated
with check (follower_id = (select auth.uid()) and follower_id <> following_id);

drop policy if exists "Users can unfollow as themselves" on public.user_follows;
create policy "Users can unfollow as themselves"
on public.user_follows for delete
to authenticated
using (follower_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('card_images', 'card_images', false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('collection_covers', 'collection_covers', false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('card_training_images', 'card_training_images', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload their card image objects" on storage.objects;
create policy "Users can upload their card image objects"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'card_images'
  and (
    owner_id = (select auth.uid())::text
    or (storage.foldername(name))[1] = (select auth.uid())::text
  )
);

drop policy if exists "Users can read visible card image objects" on storage.objects;
create policy "Users can read visible card image objects"
on storage.objects for select
to anon, authenticated
using (
  bucket_id = 'card_images'
  and exists (
    select 1
    from public.card_images image
    join public.cards card on card.id = image.card_id
    left join public.collections collection on collection.id = card.collection_id
    where image.image_url like '%' || storage.objects.name
      and (
        card.owner_id = (select auth.uid())
        or collection.visibility = 'public'
      )
  )
);

drop policy if exists "Users can update their card image objects" on storage.objects;
create policy "Users can update their card image objects"
on storage.objects for update
to authenticated
using (
  bucket_id = 'card_images'
  and (
    owner_id = (select auth.uid())::text
    or (storage.foldername(name))[1] = (select auth.uid())::text
  )
)
with check (
  bucket_id = 'card_images'
  and (
    owner_id = (select auth.uid())::text
    or (storage.foldername(name))[1] = (select auth.uid())::text
  )
);

drop policy if exists "Users can delete their card image objects" on storage.objects;
create policy "Users can delete their card image objects"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'card_images'
  and (
    owner_id = (select auth.uid())::text
    or (storage.foldername(name))[1] = (select auth.uid())::text
  )
);

drop policy if exists "Users can upload their collection covers" on storage.objects;
create policy "Users can upload their collection covers"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'collection_covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can read visible collection covers" on storage.objects;
create policy "Users can read visible collection covers"
on storage.objects for select
to anon, authenticated
using (
  bucket_id = 'collection_covers'
  and exists (
    select 1
    from public.collections collection
    where collection.cover_image_url like '%' || storage.objects.name
      and (
        collection.owner_id = (select auth.uid())
        or collection.visibility = 'public'
      )
  )
);

drop policy if exists "Users can update their collection covers" on storage.objects;
create policy "Users can update their collection covers"
on storage.objects for update
to authenticated
using (
  bucket_id = 'collection_covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'collection_covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can delete their collection covers" on storage.objects;
create policy "Users can delete their collection covers"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'collection_covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Owners upload training images" on storage.objects;
create policy "Owners upload training images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'card_training_images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Owners read training images" on storage.objects;
create policy "Owners read training images"
on storage.objects for select
to authenticated
using (
  bucket_id = 'card_training_images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Owners update training images" on storage.objects;
create policy "Owners update training images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'card_training_images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'card_training_images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Owners delete training images" on storage.objects;
create policy "Owners delete training images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'card_training_images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
