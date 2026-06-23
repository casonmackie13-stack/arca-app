-- Fix Supabase Auth user deletion blocked by:
--   1. storage.objects.owner FK (default RESTRICT) — addressed via explicit cleanup RPCs
--   2. protect_unsorted_collection trigger (blocks CASCADE from auth.users)
--
-- Strategy:
--   - Drop the Unsorted trigger; enforce Unsorted protection via RLS delete policy
--     (authenticated users cannot delete Unsorted; auth CASCADE bypasses RLS)
--   - Explicit storage cleanup before auth user deletion (storage FK unchanged)
--   - Add service-role / self-service storage cleanup helpers
--
-- Account deletion flow:
--   1. SELECT public.prepare_user_account_deletion('USER_UUID');
--   2. Delete user via Supabase Auth dashboard or Admin API
--   3. Public app rows cascade through auth.users

-- ---------------------------------------------------------------------------
-- 1. Unsorted protection without blocking auth cascade
-- ---------------------------------------------------------------------------

drop trigger if exists protect_unsorted_collection on public.collections;

drop policy if exists "Owners can delete their collections" on public.collections;

create policy "Owners can delete their collections"
on public.collections for delete
to authenticated
using (
  (select auth.uid()) = owner_id
  and lower(name) <> 'unsorted'
);

-- delete_collection_safely() already rejects Unsorted by name; unchanged.

-- ---------------------------------------------------------------------------
-- 2. Explicit storage cleanup (required before auth user deletion)
-- ---------------------------------------------------------------------------

create or replace function public.delete_user_owned_storage(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
  caller_role text := coalesce(
    current_setting('request.jwt.claim.role', true),
    (select auth.jwt() ->> 'role')
  );
begin
  if p_user_id is null then
    raise exception 'User id is required.';
  end if;

  if caller_role is distinct from 'service_role'
     and (select auth.uid()) is distinct from p_user_id then
    raise exception 'Not authorized to delete storage for this user.';
  end if;

  delete from storage.objects
  where bucket_id in ('card_images', 'collection_covers', 'card_training_images')
    and (
      owner = p_user_id
      or owner_id = p_user_id::text
    );

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.delete_user_owned_storage(uuid) from public;
revoke all on function public.delete_user_owned_storage(uuid) from anon;
grant execute on function public.delete_user_owned_storage(uuid) to authenticated;
grant execute on function public.delete_user_owned_storage(uuid) to service_role;

create or replace function public.prepare_user_account_deletion(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  storage_deleted integer;
  caller_role text := coalesce(
    current_setting('request.jwt.claim.role', true),
    (select auth.jwt() ->> 'role')
  );
begin
  if p_user_id is null then
    raise exception 'User id is required.';
  end if;

  if caller_role is distinct from 'service_role'
     and (select auth.uid()) is distinct from p_user_id then
    raise exception 'Not authorized to prepare deletion for this user.';
  end if;

  storage_deleted := public.delete_user_owned_storage(p_user_id);

  return jsonb_build_object(
    'user_id', p_user_id,
    'storage_objects_deleted', storage_deleted,
    'next_step', 'Delete auth user via Supabase Auth Admin API or SQL: DELETE FROM auth.users WHERE id = $1'
  );
end;
$$;

revoke all on function public.prepare_user_account_deletion(uuid) from public;
revoke all on function public.prepare_user_account_deletion(uuid) from anon;
grant execute on function public.prepare_user_account_deletion(uuid) to authenticated;
grant execute on function public.prepare_user_account_deletion(uuid) to service_role;
