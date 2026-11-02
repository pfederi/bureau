-- supabase/migrations/0020_customer_guthaben.sql
-- Guthaben der Kunden (z. B. Überzahlungen): wird an Rechnungen angerechnet statt zurückbezahlt.
-- Der Rechnungsbetrag bleibt der Umsatz; der Kunde zahlt nur noch den Rest.

create table if not exists customer_guthaben (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete restrict,
  datum date not null default current_date,
  betrag numeric not null check (betrag > 0),
  beschreibung text not null,
  -- überzahlte Rechnung (optional)
  invoice_id uuid references invoices(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists customer_guthaben_customer_idx on customer_guthaben (customer_id, datum);
alter table customer_guthaben enable row level security;
drop policy if exists "admin_all_customer_guthaben" on customer_guthaben;
create policy "admin_all_customer_guthaben" on customer_guthaben for all to authenticated
  using ((select public.has_admin_access())) with check ((select public.has_admin_access()));
revoke all on customer_guthaben from anon;

-- Angerechnetes Guthaben pro Rechnung und Herkunft für das PDF (z. B. «Überzahlung RE-…»)
alter table invoices add column if not exists guthaben_angerechnet numeric not null default 0
  check (guthaben_angerechnet >= 0);
alter table invoices add column if not exists guthaben_text text;
