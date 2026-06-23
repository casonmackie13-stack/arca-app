-- Social layer: follows, public profile reads, public collection/card discovery.
-- Collections already have visibility ('public' | 'private'). Cards inherit collection visibility.

alter table public.profiles
  add column if not exists bio text;

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username));

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

alter table public.user_follows enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'Profiles are publicly readable'
  ) then
    create policy "Profiles are publicly readable"
      on public.profiles for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'Users can update own profile'
  ) then
    create policy "Users can update own profile"
      on public.profiles for update
      to authenticated
      using (id = (select auth.uid()))
      with check (id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'collections' and policyname = 'Anyone can read public collections'
  ) then
    create policy "Anyone can read public collections"
      on public.collections for select
      to anon, authenticated
      using (
        owner_id = (select auth.uid())
        or visibility = 'public'
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cards' and policyname = 'Anyone can read public cards'
  ) then
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
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'card_images' and policyname = 'Anyone can read images for readable cards'
  ) then
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
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_follows' and policyname = 'Anyone can read follow relationships'
  ) then
    create policy "Anyone can read follow relationships"
      on public.user_follows for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_follows' and policyname = 'Users can follow as themselves'
  ) then
    create policy "Users can follow as themselves"
      on public.user_follows for insert
      to authenticated
      with check (follower_id = (select auth.uid()) and follower_id <> following_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_follows' and policyname = 'Users can unfollow as themselves'
  ) then
    create policy "Users can unfollow as themselves"
      on public.user_follows for delete
      to authenticated
      using (follower_id = (select auth.uid()));
  end if;
end
$$;
