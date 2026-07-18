
drop policy if exists "content-images auth insert" on storage.objects;
create policy "content-images auth insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'content-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "content-images auth read own" on storage.objects;
create policy "content-images auth read own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'content-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "content-images owner update" on storage.objects;
create policy "content-images owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'content-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "content-images owner delete" on storage.objects;
create policy "content-images owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'content-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
