-- Aircraft and the airfoils they use.
-- Read access is public; writes go through the service key, which bypasses RLS.

create table public.aircraft (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,
  name         text not null,
  display_name text,
  category     text check (category in ('conventional', 'canard-tandem', 'rotorcraft')),
  year         int,
  country      text,
  hidden       boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()  -- set by the loader; no trigger
);

comment on column public.aircraft.key is 'Normalised aircraft name, used as the upsert key.';
comment on column public.aircraft.name is 'Aircraft name as recorded in the sources.';
comment on column public.aircraft.display_name is 'Optional label that may differ from name; the UI shows display_name when set, else name.';
comment on column public.aircraft.hidden is 'When true the aircraft is not shown on the site. Set by hand; the loader must preserve it.';

create table public.aircraft_airfoils (
  id                  uuid primary key default gen_random_uuid(),
  aircraft_id         uuid not null references public.aircraft(id) on delete cascade,
  airfoil_id          uuid references public.airfoils(id) on delete set null,
  probable_airfoil_id uuid references public.airfoils(id) on delete set null,
  airfoil_name        text not null,
  surface             text not null,
  position            text not null check (position in ('root', 'tip', 'mid', 'inboard', 'outboard', 'all', 'unspecified')),
  modified            boolean not null default false,
  uncertain           boolean not null default false,
  thickness_pct       numeric,
  sources             jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now(),
  constraint aircraft_airfoils_one_match check (airfoil_id is null or probable_airfoil_id is null)
);

comment on table public.aircraft_airfoils is 'One row per airfoil usage on an aircraft (surface + position). The loader wipes and refills this table.';
comment on column public.aircraft_airfoils.airfoil_id is 'Exact match in the catalog. Only this link is shown on the site.';
comment on column public.aircraft_airfoils.probable_airfoil_id is 'Unverified match in the catalog, held back from display. Never set together with airfoil_id.';
comment on column public.aircraft_airfoils.airfoil_name is 'Standardised airfoil name from the sources, e.g. ''NACA 64A212''. Kept even when the airfoil is not in the catalog.';
comment on column public.aircraft_airfoils.surface is 'Known values: wing, upper_wing, lower_wing, fwd_wing, aft_wing, canard, rotor, tail, fin, winglet. No check constraint because the list will grow.';
comment on column public.aircraft_airfoils.modified is 'Source says a modified version of the airfoil; the UI adds an asterisk.';
comment on column public.aircraft_airfoils.uncertain is 'Source marked the entry with ''?''.';
comment on column public.aircraft_airfoils.sources is 'JSON array of {name, url} objects.';

create index aircraft_airfoils_airfoil_id_idx   on public.aircraft_airfoils (airfoil_id);
create index aircraft_airfoils_aircraft_id_idx  on public.aircraft_airfoils (aircraft_id);
create index aircraft_airfoils_airfoil_name_idx on public.aircraft_airfoils (airfoil_name);

alter table public.aircraft          enable row level security;
alter table public.aircraft_airfoils enable row level security;

create policy "Public read" on public.aircraft
  for select to anon, authenticated using (not hidden);
create policy "Public read" on public.aircraft_airfoils
  for select to anon, authenticated
  using (exists (select 1 from public.aircraft a where a.id = aircraft_id and not a.hidden));

-- Rollback:
-- drop table if exists public.aircraft_airfoils;
-- drop table if exists public.aircraft;
