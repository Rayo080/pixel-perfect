create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  user_id uuid references auth.users on delete cascade unique not null,
  name text,
  age int,
  weight numeric,
  height numeric,
  gender text,
  activity text,
  goals text,
  maintenance_calories int default 2000,
  target_calories int default 2000,
  target_proteins int default 150,
  body_photo_path text,
  body_assessment jsonb,
  body_assessment_created_at timestamptz,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create table if not exists public.meals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  calories int not null,
  proteins int not null,
  comment text,
  image_url text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

insert into storage.buckets (id, name, public)
values ('body-progress', 'body-progress', false)
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.meals enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Los usuarios pueden ver su propio perfil') then
    create policy "Los usuarios pueden ver su propio perfil" on public.profiles for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Los usuarios pueden actualizar su propio perfil') then
    create policy "Los usuarios pueden actualizar su propio perfil" on public.profiles for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Los usuarios pueden insertar su propio perfil') then
    create policy "Los usuarios pueden insertar su propio perfil" on public.profiles for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'meals' and policyname = 'Los usuarios pueden ver sus propias comidas') then
    create policy "Los usuarios pueden ver sus propias comidas" on public.meals for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'meals' and policyname = 'Los usuarios pueden insertar sus propias comidas') then
    create policy "Los usuarios pueden insertar sus propias comidas" on public.meals for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'meals' and policyname = 'Los usuarios pueden borrar sus propias comidas') then
    create policy "Los usuarios pueden borrar sus propias comidas" on public.meals for delete using (auth.uid() = user_id);
  end if;
end $$;

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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, user_id, name)
  values (new.id, new.id, new.raw_user_meta_data->>'name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
