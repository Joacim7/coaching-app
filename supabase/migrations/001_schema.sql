-- ============================================================
-- COACHING APP — DATABASE SCHEMA
-- Run this in Supabase SQL editor or via supabase db push
-- ============================================================

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  role text not null check (role in ('coach', 'client')),
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Automatically create a profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Coach–client relationships
create table if not exists public.coach_clients (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  unique(coach_id, client_id)
);

-- Training plans
create table if not exists public.training_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  start_date date,
  end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Training sessions (days within a plan)
create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  training_plan_id uuid not null references public.training_plans(id) on delete cascade,
  day_of_week int check (day_of_week between 1 and 7), -- 1=Monday, 7=Sunday
  title text not null,
  exercises jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- Meal plans
create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  calories_target int,
  protein_g int,
  carbs_g int,
  fat_g int,
  meals jsonb not null default '[]',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Check-in templates (created by coaches)
create table if not exists public.checkin_templates (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  type text not null check (type in ('daily', 'weekly')),
  questions jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- Check-ins (filled by clients)
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  template_id uuid references public.checkin_templates(id) on delete set null,
  type text not null check (type in ('daily', 'weekly')),
  answers jsonb not null default '{}',
  mood int check (mood between 1 and 5),
  notes text,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_coach_clients_coach on public.coach_clients(coach_id);
create index if not exists idx_coach_clients_client on public.coach_clients(client_id);
create index if not exists idx_training_plans_client on public.training_plans(client_id);
create index if not exists idx_meal_plans_client on public.meal_plans(client_id);
create index if not exists idx_checkins_client on public.checkins(client_id);
create index if not exists idx_checkins_created on public.checkins(created_at desc);
