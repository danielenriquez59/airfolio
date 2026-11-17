-- Admin-only direct writes (the manager pages). A user is an admin when their auth id
-- is in public.admins; add another admin by inserting a row. Uploads by ordinary
-- signed-in users go through the backend, not through these policies.
-- Safe to run more than once.

create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
-- No policies: only the service key and is_admin() can read it.
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Every table the admin pages write to. "for all" includes select, so admins also
-- see rows the public policies hide (e.g. hidden aircraft).
-- (select ...) makes Postgres evaluate is_admin() once per query, not once per row.
do $$
declare t text;
begin
  foreach t in array array['airfoils', 'categories', 'aircraft', 'aircraft_airfoils', 'performance_cache'] loop
    execute format('drop policy if exists "Admin write" on public.%I', t);
    execute format(
      'create policy "Admin write" on public.%I for all to authenticated
         using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end $$;

-- Who uploaded each airfoil, for moderation. Written by the backend (service key).
-- Kept out of public.airfoils so user ids never appear in public reads.
create table if not exists public.airfoil_uploads (
  airfoil_id uuid primary key references public.airfoils(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
-- No policies: only the service key can read or write it.
alter table public.airfoil_uploads enable row level security;

-- Rollback:
-- drop table if exists public.airfoil_uploads;
-- drop policy if exists "Admin write" on public.<table>;  -- for each of the five tables above
-- drop function if exists public.is_admin();
-- drop table if exists public.admins;
