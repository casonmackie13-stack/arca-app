alter table public.collections
add column if not exists cover_image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('collection_covers', 'collection_covers', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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
