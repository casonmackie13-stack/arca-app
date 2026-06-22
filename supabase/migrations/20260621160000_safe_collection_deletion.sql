do $$
begin
  if exists (
    select 1
    from public.collections
    where lower(name) = 'unsorted'
    group by owner_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate Unsorted collections exist. Consolidate them before applying this migration.';
  end if;
end
$$;

create unique index if not exists collections_one_unsorted_per_owner
on public.collections (owner_id)
where lower(name) = 'unsorted';

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cards' and policyname = 'Owners can update their cards'
  ) then
    create policy "Owners can update their cards"
    on public.cards for update
    to authenticated
    using ((select auth.uid()) = owner_id)
    with check (
      (select auth.uid()) = owner_id
      and (
        collection_id is null
        or exists (
          select 1 from public.collections
          where collections.id = cards.collection_id
            and collections.owner_id = (select auth.uid())
        )
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'collections' and policyname = 'Owners can delete their collections'
  ) then
    create policy "Owners can delete their collections"
    on public.collections for delete
    to authenticated
    using ((select auth.uid()) = owner_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'card_images' and policyname = 'Owners can update their card images'
  ) then
    create policy "Owners can update their card images"
    on public.card_images for update
    to authenticated
    using (
      exists (
        select 1 from public.cards
        where cards.id = card_images.card_id
          and cards.owner_id = (select auth.uid())
      )
    )
    with check (
      exists (
        select 1 from public.cards
        where cards.id = card_images.card_id
          and cards.owner_id = (select auth.uid())
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Owners can delete their card images'
  ) then
    create policy "Owners can delete their card images"
    on storage.objects for delete
    to authenticated
    using (
      bucket_id = 'card_images'
      and owner_id = (select auth.uid()::text)
    );
  end if;
end
$$;

create or replace function public.prevent_unsorted_collection_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if lower(old.name) = 'unsorted' then
    raise exception 'The Unsorted collection cannot be deleted.';
  end if;
  return old;
end;
$$;

drop trigger if exists protect_unsorted_collection on public.collections;
create trigger protect_unsorted_collection
before delete on public.collections
for each row execute function public.prevent_unsorted_collection_delete();

create or replace function public.delete_collection_safely(target_collection_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_name text;
  unsorted_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select name into target_name
  from public.collections
  where id = target_collection_id
    and owner_id = current_user_id
  for update;

  if target_name is null then
    raise exception 'Collection not found.';
  end if;

  if lower(target_name) = 'unsorted' then
    raise exception 'The Unsorted collection cannot be deleted.';
  end if;

  select id into unsorted_id
  from public.collections
  where owner_id = current_user_id
    and lower(name) = 'unsorted'
  order by created_at asc
  limit 1;

  if unsorted_id is null then
    begin
      insert into public.collections (owner_id, name, category, visibility, description)
      values (current_user_id, 'Unsorted', 'Other', 'private', 'Cards awaiting a permanent collection.')
      returning id into unsorted_id;
    exception when unique_violation then
      select id into unsorted_id
      from public.collections
      where owner_id = current_user_id and lower(name) = 'unsorted'
      order by created_at asc
      limit 1;
    end;
  end if;

  update public.cards
  set collection_id = unsorted_id
  where collection_id = target_collection_id
    and owner_id = current_user_id;

  delete from public.collections
  where id = target_collection_id
    and owner_id = current_user_id;

  if not found then
    raise exception 'Collection could not be deleted.';
  end if;

  return unsorted_id;
end;
$$;

revoke all on function public.delete_collection_safely(uuid) from public;
revoke all on function public.delete_collection_safely(uuid) from anon;
grant execute on function public.delete_collection_safely(uuid) to authenticated;

revoke all on function public.prevent_unsorted_collection_delete() from public;
revoke all on function public.prevent_unsorted_collection_delete() from anon;
