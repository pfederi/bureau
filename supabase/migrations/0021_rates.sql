-- supabase/migrations/0021_rates.sql
-- Ansatz pro Kunde (leer = Standard aus den Einstellungen) und pro Projekt eines Kunden.
-- Zeiteinträge speichern ihren Satz weiterhin selbst; das hier sind nur Vorschläge.

alter table customers add column if not exists stundensatz numeric(10,2)
  check (stundensatz is null or stundensatz > 0);

create table if not exists project_rates (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  projekt text not null check (btrim(projekt) <> ''),
  stundensatz numeric(10,2) not null check (stundensatz > 0),
  created_at timestamptz not null default now()
);
-- ein Ansatz pro Kunde und Projekt, Gross-/Kleinschreibung und Leerzeichen am Rand egal
create unique index if not exists project_rates_customer_projekt_idx
  on project_rates (customer_id, lower(btrim(projekt)));
alter table project_rates enable row level security;
drop policy if exists "admin_all_project_rates" on project_rates;
create policy "admin_all_project_rates" on project_rates for all to authenticated
  using ((select public.has_admin_access())) with check ((select public.has_admin_access()));
revoke all on project_rates from anon;
