-- Applied to the dedicated v2 Supabase project.
alter table public.resource_metrics
  add column if not exists region text,
  add column if not exists provisioned_vcpu integer,
  add column if not exists provisioned_memory_gb numeric(12,3),
  add column if not exists pricing_currency char(3);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'resource_metrics_vcpu_positive'
  ) then
    alter table public.resource_metrics
      add constraint resource_metrics_vcpu_positive
      check (provisioned_vcpu is null or provisioned_vcpu > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'resource_metrics_memory_positive'
  ) then
    alter table public.resource_metrics
      add constraint resource_metrics_memory_positive
      check (provisioned_memory_gb is null or provisioned_memory_gb > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'cloud_profiles_user_provider_unique'
  ) then
    alter table public.cloud_profiles
      add constraint cloud_profiles_user_provider_unique unique (user_id, provider);
  end if;
end $$;
