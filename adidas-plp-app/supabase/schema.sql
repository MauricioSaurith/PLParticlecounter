-- Run once in your project's Supabase SQL editor.
create table if not exists public.catalog_counts (
  day date not null,
  market text not null check (market in ('US','CA','CA-FR')),
  url text not null,
  checked_at timestamptz not null,
  total integer,
  status text not null check (status in ('success','error')),
  error text,
  primary key (day, market),
  check ((status = 'success' and total >= 0 and total is not null and error is null)
      or (status = 'error' and total is null))
);
alter table public.catalog_counts enable row level security;
revoke all on public.catalog_counts from anon, authenticated;
grant select, insert, update on public.catalog_counts to service_role;

create or replace function public.save_catalog_counts(observations jsonb)
returns void language sql security invoker set search_path = public as $$
  insert into public.catalog_counts(day,market,url,checked_at,total,status,error)
  select day,market,url,checked_at,total,status,error
  from jsonb_to_recordset(observations) as x(day date,market text,url text,checked_at timestamptz,total integer,status text,error text)
  on conflict (day,market) do update set
    url=excluded.url, checked_at=excluded.checked_at, total=excluded.total,
    status=excluded.status,error=excluded.error
  where catalog_counts.status <> 'success';
$$;
revoke all on function public.save_catalog_counts(jsonb) from public, anon, authenticated;
grant execute on function public.save_catalog_counts(jsonb) to service_role;
