create extension if not exists pgcrypto;

create table if not exists public.tryon_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  provider text not null,
  status text not null default 'queued',
  mode text,
  item_type text,
  garment_source text,
  person_image_name text,
  garment_image_name text,
  result_image_url text,
  result_storage_path text,
  raw_provider_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tryon_jobs_created_at_idx on public.tryon_jobs (created_at desc);
create index if not exists tryon_jobs_status_idx on public.tryon_jobs (status);

alter table public.tryon_jobs enable row level security;

drop policy if exists "Service role can manage tryon jobs" on public.tryon_jobs;
create policy "Service role can manage tryon jobs"
on public.tryon_jobs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

insert into storage.buckets (id, name, public)
values ('tryon-results', 'tryon-results', false)
on conflict (id) do nothing;
