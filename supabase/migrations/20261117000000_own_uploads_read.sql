-- Let a signed-in user read their own upload records, for the "My uploads" list on
-- the account page. Writes still go only through the backend (service key).
-- Safe to run more than once.

drop policy if exists "Read own uploads" on public.airfoil_uploads;
create policy "Read own uploads" on public.airfoil_uploads
  for select to authenticated using (user_id = (select auth.uid()));

create index if not exists airfoil_uploads_user_id_idx on public.airfoil_uploads (user_id);

-- Rollback:
-- drop policy if exists "Read own uploads" on public.airfoil_uploads;
-- drop index if exists public.airfoil_uploads_user_id_idx;
