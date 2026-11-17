-- Tighten public access. RLS was already on for every public table; this removes
-- an unused read policy, lets logged-in users read what anon can, and revokes anon
-- write privileges so writes stay blocked even if RLS is ever switched off.
-- Safe to run more than once.

-- batch_jobs is never read by the frontend.
drop policy if exists "Allow public read access to batch_jobs" on public.batch_jobs;

alter policy "Allow public read access to airfoils"          on public.airfoils          to anon, authenticated;
alter policy "Allow public read access to categories"        on public.categories        to anon, authenticated;
alter policy "Allow public read access to performance_cache" on public.performance_cache to anon, authenticated;

revoke insert, update, delete, truncate on all tables in schema public from anon;
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon;

-- Security advisor: pin search_path so callers can't swap in their own objects.
alter function public.update_updated_at_column() set search_path = '';
alter function public.get_random_airfoils(integer) set search_path = public;

-- Rollback:
-- create policy "Allow public read access to batch_jobs" on public.batch_jobs for select to anon using (true);
-- alter policy "Allow public read access to airfoils"          on public.airfoils          to anon;
-- alter policy "Allow public read access to categories"        on public.categories        to anon;
-- alter policy "Allow public read access to performance_cache" on public.performance_cache to anon;
-- grant insert, update, delete, truncate on all tables in schema public to anon;
