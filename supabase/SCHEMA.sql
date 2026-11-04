-- Schema bootstrap for Multi-Cloud Cost Optimizer.
-- Apply only to a NEW project created for this repository, after reviewing it.
-- Every application table is user-owned and protected by RLS.
create extension if not exists pgcrypto;

create table if not exists public.cloud_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('aws','azure','gcp')),
  display_name text not null,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cloud_profile_id uuid not null,
  data_type text not null check (data_type in ('billing','metrics')),
  original_filename text not null,
  status text not null default 'validated' check (status in ('validated','imported','failed')),
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  invalid_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (cloud_profile_id, user_id)
    references public.cloud_profiles(id, user_id) on delete cascade
);

create table if not exists public.billing_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  import_batch_id uuid not null,
  provider text not null check (provider in ('aws','azure','gcp')),
  resource_id text,
  resource_name text,
  service_name text not null,
  resource_type text,
  region text,
  usage_start timestamptz not null,
  usage_end timestamptz,
  usage_quantity numeric,
  usage_unit text,
  cost numeric(20,8) not null,
  currency char(3) not null,
  charge_type text,
  source_row_hash text not null,
  created_at timestamptz not null default now(),
  unique (import_batch_id, source_row_hash),
  foreign key (import_batch_id, user_id)
    references public.import_batches(id, user_id) on delete cascade
);

create table if not exists public.resource_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  import_batch_id uuid not null references public.import_batches(id) on delete cascade,
  provider text not null check (provider in ('aws','azure','gcp')),
  resource_id text not null,
  observed_at timestamptz not null,
  cpu_utilization_pct numeric(6,3) check (cpu_utilization_pct between 0 and 100),
  memory_utilization_pct numeric(6,3) check (memory_utilization_pct between 0 and 100),
  active_hours numeric(12,4) check (active_hours >= 0),
  observed_hours numeric(12,4) check (observed_hours > 0),
  created_at timestamptz not null default now(),
  foreign key (import_batch_id, user_id)
    references public.import_batches(id, user_id) on delete cascade
);

create table if not exists public.optimization_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('aws','azure','gcp')),
  resource_id text,
  category text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  title text not null,
  explanation text not null,
  evidence jsonb not null default '{}'::jsonb,
  estimated_monthly_savings numeric(20,8),
  currency char(3),
  status text not null default 'new' check (status in ('new','accepted','dismissed','implemented')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.cost_anomalies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('aws','azure','gcp')),
  currency char(3) not null,
  period text not null,
  current_cost numeric(20,8) not null,
  baseline_average numeric(20,8) not null,
  increase_pct numeric(10,4) not null,
  severity text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_user on public.cloud_profiles(user_id);
create index if not exists idx_imports_user_created on public.import_batches(user_id, created_at desc);
create index if not exists idx_billing_user_provider_date on public.billing_records(user_id, provider, usage_start);
create index if not exists idx_billing_user_resource on public.billing_records(user_id, provider, resource_id);
create index if not exists idx_metrics_user_resource_time on public.resource_metrics(user_id, provider, resource_id, observed_at);
create index if not exists idx_recommendations_user_status on public.optimization_recommendations(user_id, status);

-- Expose these tables to the Supabase Data API for signed-in users.
-- RLS remains the row-level authorization boundary.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.cloud_profiles,
  public.import_batches,
  public.billing_records,
  public.resource_metrics,
  public.optimization_recommendations,
  public.cost_anomalies
to authenticated;

alter table public.cloud_profiles enable row level security;
alter table public.import_batches enable row level security;
alter table public.billing_records enable row level security;
alter table public.resource_metrics enable row level security;
alter table public.optimization_recommendations enable row level security;
alter table public.cost_anomalies enable row level security;

create policy "users manage their cloud profiles" on public.cloud_profiles
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "users manage their import batches" on public.import_batches
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "users manage their billing records" on public.billing_records
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "users manage their resource metrics" on public.resource_metrics
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "users manage their recommendations" on public.optimization_recommendations
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "users manage their cost anomalies" on public.cost_anomalies
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
