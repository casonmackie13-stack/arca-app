-- Ensure Explore/social discovery works on hosted DBs that may lack table grants
-- or user_follows policies from earlier manual provisioning.

create table if not exists public.user_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_follows_no_self_follow check (follower_id <> following_id),
  constraint user_follows_unique unique (follower_id, following_id)
);

create index if not exists user_follows_follower_idx on public.user_follows (follower_id);
create index if not exists user_follows_following_idx on public.user_follows (following_id);

alter table public.profiles enable row level security;
alter table public.collections enable row level security;
alter table public.cards enable row level security;
alter table public.card_images enable row level security;
alter table public.user_follows enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.collections, public.cards, public.card_images, public.user_follows to anon, authenticated;
grant insert, update, delete on public.profiles, public.collections, public.cards, public.card_images, public.user_follows to authenticated;

drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable"
on public.profiles for select
to anon, authenticated
using (true);

drop policy if exists "Anyone can read public collections" on public.collections;
create policy "Anyone can read public collections"
on public.collections for select
to anon, authenticated
using (visibility = 'public' or owner_id = (select auth.uid()));

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
