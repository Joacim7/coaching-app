-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.coach_clients enable row level security;
alter table public.training_plans enable row level security;
alter table public.training_sessions enable row level security;
alter table public.meal_plans enable row level security;
alter table public.checkin_templates enable row level security;
alter table public.checkins enable row level security;

-- Helper: get current user's role
create or replace function public.get_my_role()
returns text language sql security definer stable as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Helper: check if current user is a coach of given client
create or replace function public.is_my_client(p_client_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.coach_clients
    where coach_id = auth.uid() and client_id = p_client_id and status = 'active'
  );
$$;

-- ── profiles ──────────────────────────────────────────────────
create policy "Users can view their own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Coaches can view their clients' profiles"
  on public.profiles for select
  using (public.is_my_client(id));

create policy "Users can update their own profile"
  on public.profiles for update
  using (id = auth.uid());

-- ── coach_clients ─────────────────────────────────────────────
create policy "Coaches can manage their client relationships"
  on public.coach_clients for all
  using (coach_id = auth.uid());

create policy "Clients can view their coach relationships"
  on public.coach_clients for select
  using (client_id = auth.uid());

-- ── training_plans ────────────────────────────────────────────
create policy "Coaches can manage training plans for their clients"
  on public.training_plans for all
  using (coach_id = auth.uid());

create policy "Clients can view their own training plans"
  on public.training_plans for select
  using (client_id = auth.uid());

-- ── training_sessions ─────────────────────────────────────────
create policy "Coaches can manage sessions of their plans"
  on public.training_sessions for all
  using (
    exists (
      select 1 from public.training_plans
      where id = training_plan_id and coach_id = auth.uid()
    )
  );

create policy "Clients can view their sessions"
  on public.training_sessions for select
  using (
    exists (
      select 1 from public.training_plans
      where id = training_plan_id and client_id = auth.uid()
    )
  );

-- ── meal_plans ────────────────────────────────────────────────
create policy "Coaches can manage meal plans for their clients"
  on public.meal_plans for all
  using (coach_id = auth.uid());

create policy "Clients can view their own meal plans"
  on public.meal_plans for select
  using (client_id = auth.uid());

-- ── checkin_templates ─────────────────────────────────────────
create policy "Coaches can manage their check-in templates"
  on public.checkin_templates for all
  using (coach_id = auth.uid());

create policy "Clients can view templates from their coaches"
  on public.checkin_templates for select
  using (
    exists (
      select 1 from public.coach_clients
      where coach_id = checkin_templates.coach_id
        and client_id = auth.uid()
        and status = 'active'
    )
  );

-- ── checkins ──────────────────────────────────────────────────
create policy "Clients can create and view their own check-ins"
  on public.checkins for all
  using (client_id = auth.uid());

create policy "Coaches can view check-ins of their clients"
  on public.checkins for select
  using (public.is_my_client(client_id));
