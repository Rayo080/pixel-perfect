alter table public.profiles
  add column if not exists steps_daily int not null default 6000;
