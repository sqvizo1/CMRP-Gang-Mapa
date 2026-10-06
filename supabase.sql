-- CMRP MAPA - Supabase databáza
-- Spusti celý tento SQL skript v Supabase SQL Editor.

create table if not exists public.map_state (
  id integer primary key check (id = 1),
  data jsonb not null default '{"territories":[],"workshops":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.map_state (id, data)
values (1, '{"territories":[],"workshops":[]}'::jsonb)
on conflict (id) do nothing;

alter table public.map_state enable row level security;

-- Verejnosť môže mapu čítať.
drop policy if exists "Public can read map" on public.map_state;
create policy "Public can read map"
on public.map_state
for select
to anon, authenticated
using (true);

-- ============================================================
-- DÔLEŽITÉ:
-- Nahraď email@example.com svojím ADMIN E-MAILOM.
-- Iba tento účet bude môcť mapu meniť.
-- ============================================================

drop policy if exists "Admin can insert map" on public.map_state;
create policy "Admin can insert map"
on public.map_state
for insert
to authenticated
with check ((auth.jwt() ->> 'email') = 'email@example.com');

drop policy if exists "Admin can update map" on public.map_state;
create policy "Admin can update map"
on public.map_state
for update
to authenticated
using ((auth.jwt() ->> 'email') = 'email@example.com')
with check ((auth.jwt() ->> 'email') = 'email@example.com');

drop policy if exists "Admin can delete map" on public.map_state;
create policy "Admin can delete map"
on public.map_state
for delete
to authenticated
using ((auth.jwt() ->> 'email') = 'email@example.com');

grant select on public.map_state to anon, authenticated;
grant insert, update, delete on public.map_state to authenticated;
