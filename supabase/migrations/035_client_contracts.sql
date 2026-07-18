create table if not exists public.client_contracts (
  id              uuid          primary key default gen_random_uuid(),
  client_id       uuid          not null references public.profiles(id) on delete cascade,
  coach_id        uuid          not null references public.profiles(id) on delete cascade,
  monthly_price   numeric(10,2) not null default 0,
  duration_months integer       not null default 1,
  start_date      date          not null,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now(),
  unique(coach_id, client_id)
);

alter table public.client_contracts enable row level security;

create policy "coaches_manage_contracts"
  on public.client_contracts for all
  using  (coach_id = auth.uid())
  with check (coach_id = auth.uid());
