alter table public.profiles
  add column if not exists body_photo_path text,
  add column if not exists body_assessment jsonb,
  add column if not exists body_assessment_created_at timestamptz;

insert into storage.buckets (id, name, public)
values ('body-progress', 'body-progress', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Usuarios pueden subir sus fotos corporales') then
    create policy "Usuarios pueden subir sus fotos corporales" on storage.objects for insert to authenticated
      with check (bucket_id = 'body-progress' and (storage.foldername(name))[1] = (select auth.uid()::text));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Usuarios pueden ver sus fotos corporales') then
    create policy "Usuarios pueden ver sus fotos corporales" on storage.objects for select to authenticated
      using (bucket_id = 'body-progress' and (storage.foldername(name))[1] = (select auth.uid()::text));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Usuarios pueden actualizar sus fotos corporales') then
    create policy "Usuarios pueden actualizar sus fotos corporales" on storage.objects for update to authenticated
      using (bucket_id = 'body-progress' and (storage.foldername(name))[1] = (select auth.uid()::text))
      with check (bucket_id = 'body-progress' and (storage.foldername(name))[1] = (select auth.uid()::text));
  end if;
end $$;
