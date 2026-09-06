alter table public.profiles
  add column if not exists weekly_plan jsonb not null default '{}'::jsonb,
  add column if not exists daily_override_date date,
  add column if not exists daily_override_activity text;
