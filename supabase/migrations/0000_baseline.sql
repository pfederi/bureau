-- Bureau: Ausgangsschema der Datenbank
--
-- Alle Tabellen mit Row Level Security; Zugriff nur für eingetragene Admins (admin_users),
-- mit Zwei-Faktor-Code, sobald einer eingerichtet ist (has_admin_access()).
-- anon (ohne Anmeldung) hat keine Rechte auf Tabellen und Funktionen.

-- Typen ------------------------------------------------------------------
create type invoice_type as enum ('pauschal', 'stunden');
create type invoice_status as enum ('entwurf', 'versendet', 'bezahlt', 'storniert');

do $$ begin
  create type quote_status as enum ('entwurf', 'versendet', 'angenommen', 'abgelehnt');
exception when duplicate_object then null; end $$;

-- Kunden -----------------------------------------------------------------
create sequence if not exists kundennummer_seq start 1;

create table customers (
  id uuid primary key default gen_random_uuid(),
  kundennummer int not null default nextval('kundennummer_seq') unique,
  firma_oder_name text not null,
  adresse text,
  plz text,
  ort text,
  land text not null default 'Schweiz',
  email text,
  ansprechperson text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Rechnungsnummer je Kunde: RE-{YYYY}-{MON}-{DD}-{kundennummer}-{####}
  rechnung_counter int not null default 0,
  -- Grussformel auf der Rechnung
  gruss text not null default 'Freundliche Grüsse',
  -- Hosting pro Kunde (ein Abo): Text, Monatspreis, aktiver Zeitraum (jeweils
  -- erster Tag des Monats). Für die anteilige Jahresrechnung.
  hosting_text text,
  hosting_preis_monat numeric
    check (hosting_preis_monat is null or hosting_preis_monat >= 0),
  hosting_ab date,
  hosting_bis date,
  -- Stundenbudget pro Kunde
  stunden_budget numeric
    check (stunden_budget is null or stunden_budget > 0),
  budget_zeitraum text
    check (budget_zeitraum is null or budget_zeitraum in ('monat', 'jahr')),
  -- Offertnummer je Kunde: OF-{YYYY}-{MON}-{DD}-{kundennummer}-{####}
  offerte_counter int not null default 0,
  -- Kundenlink: zufälliges Token, nur vom Admin erstellt oder widerrufen;
  -- die öffentliche Seite liest per Service-Key.
  portal_token text unique,
  portal_erstellt_am timestamptz,
  constraint customers_hosting_zeitraum_check
    check (hosting_ab is null or hosting_bis is null or hosting_bis >= hosting_ab)
);

-- Einstellungen (Einzelzeile) --------------------------------------------
-- Absender und Bankverbindung trägt der Betreiber im Admin unter Einstellungen ein.
create table settings (
  id int primary key default 1 check (id = 1),
  absender_name text not null default '',
  absender_adresse text not null default '',
  absender_plz_ort text not null default '',
  absender_land text not null default 'Schweiz',
  absender_tel text not null default '',
  absender_email text not null default '',
  bank_name text not null default '',
  iban text not null default '',
  standard_stundensatz numeric not null default 120,
  mwst_hinweis text not null default 'Von der MWST gemäss Art. 10 Abs. 2 befreit.',
  naechste_nummer int not null default 1,
  updated_at timestamptz not null default now(),
  -- Grenzsteuersatz für die Schätzung der Steuer-Rücklage
  grenzsteuersatz numeric not null default 25
    check (grenzsteuersatz >= 0 and grenzsteuersatz <= 60),
  -- Ausgeblendete Hinweise auf fehlende Belege wiederkehrender Ausgaben («Reihe@letztes Datum»).
  -- Gilt für Ausgaben-Seite, Dashboard und Wochenmail; ein neuer Beleg der Reihe macht sie wieder aktiv.
  belege_ausgeblendet text[] not null default '{}'
);
insert into settings (id) values (1);

-- Rechnungen -------------------------------------------------------------
create table invoices (
  id uuid primary key default gen_random_uuid(),
  rechnungsnummer text not null unique,
  customer_id uuid not null references customers(id) on delete restrict,
  typ invoice_type not null,
  status invoice_status not null default 'entwurf',
  rechnungsdatum date not null default current_date,
  leistungsdatum text,
  betrag numeric not null default 0,
  waehrung text not null default 'CHF',
  notiz text,
  mwst_hinweis text not null default 'Von der MWST gemäss Art. 10 Abs. 2 befreit.',
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Rabatt in Prozent. `betrag` bleibt der Endbetrag nach Rabatt.
  rabatt_prozent numeric not null default 0
    check (rabatt_prozent >= 0 and rabatt_prozent <= 100),
  -- Für welches Jahr eine Rechnung das Hosting enthält (Warnung vor Doppelverrechnung).
  hosting_jahr int,
  -- Rechnung wird nicht bezahlt, sondern mit Materialbezügen gegengerechnet (Modul Material).
  verrechnung_material boolean not null default false,
  erinnert_am timestamptz,  -- letzte Zahlungserinnerung
  storniert_am timestamptz
  -- offerte_id folgt nach der Tabelle quotes
);

create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  position int not null,
  bezeichnung text not null,
  menge numeric not null default 1,
  einheit text not null default 'Stück',
  einzelpreis numeric not null default 0,
  gesamtpreis numeric not null default 0
);

-- Zeiterfassung ----------------------------------------------------------
create table time_entries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete restrict,
  datum date not null default current_date,
  beschreibung text not null,
  stunden numeric not null,
  stundensatz numeric not null,
  billed boolean not null default false,
  invoice_id uuid references invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Projekt pro Zeiteintrag (Auswertung pro Projekt)
  projekt text
);
create index if not exists time_entries_projekt_idx on time_entries (customer_id, projekt);

-- Offerten -----------------------------------------------------------------
create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  offertnummer text not null unique,
  customer_id uuid not null references customers(id) on delete restrict,
  status quote_status not null default 'entwurf',
  offertdatum date not null default current_date,
  gueltig_bis date,
  betrag numeric not null default 0,
  rabatt_prozent numeric not null default 0 check (rabatt_prozent >= 0 and rabatt_prozent <= 100),
  notiz text,
  mwst_hinweis text not null default '',
  sent_at timestamptz,
  invoice_id uuid references invoices(id) on delete set null,  -- daraus erstellte Rechnung
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  position int not null,
  bezeichnung text not null,
  menge numeric not null default 1,
  einheit text not null default 'Stück',
  einzelpreis numeric not null default 0,
  gesamtpreis numeric not null default 0
);
create index if not exists quote_items_quote_idx on quote_items (quote_id);

alter table invoices add column if not exists offerte_id uuid references quotes(id) on delete set null;

-- Ausgaben mit Beleg für den Jahresabschluss (Hilfsblatt A, Kanton Zürich) ---
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  datum date not null default current_date,
  beschreibung text not null,
  lieferant text,
  kategorie text not null check (kategorie in (
    'material', 'fremdleistungen', 'software', 'hosting', 'hardware',
    'buero', 'reise', 'werbung', 'weiterbildung', 'uebriges'
  )),
  betrag numeric not null check (betrag > 0),
  beleg_path text,   -- Objekt im privaten Bucket expense-receipts
  beleg_name text,   -- ursprünglicher Dateiname
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Ausgaben in Fremdwährung: Originalbetrag und Währung; `betrag` bleibt der Franken-Betrag
  -- (effektiv belastet oder zum EZB-Referenzkurs des Belegdatums umgerechnet).
  waehrung text not null default 'CHF'
    check (waehrung in ('CHF', 'EUR', 'USD')),
  betrag_original numeric
    check (betrag_original is null or betrag_original > 0),
  constraint expenses_fremdwaehrung_check
    check (waehrung = 'CHF' or betrag_original is not null)
);
create index if not exists expenses_datum_idx on expenses (datum);

-- Admins -------------------------------------------------------------------
-- Bewusst ohne Policy: nur der Service-Key (bzw. die Funktionen unten) liest die Liste.
create table if not exists admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,   -- nur zur Übersicht
  created_at timestamptz not null default now()
);

-- Versendete Stundenrapporte (Monat = erster Tag des Monats) -----------------
create table if not exists time_reports (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  monat date not null,
  an text not null,
  stunden numeric not null,
  sent_at timestamptz not null default now()
);
create index if not exists time_reports_customer_idx on time_reports (customer_id, monat desc);

-- Überwachte Websites der Kunden (Erreichbarkeit, SSL-Zertifikat, Domain-Ablauf) --
create table if not exists monitored_sites (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now(),
  geprueft_am timestamptz,
  erreichbar boolean,
  http_status int,
  antwort_ms int,
  fehler text,
  -- aufeinanderfolgende Fehlschläge; ab 2 gilt die Seite als down (kein Fehlalarm bei einem Aussetzer)
  fehlversuche int not null default 0,
  down_seit timestamptz,
  ssl_ablauf date,
  domain_ablauf date,
  unique (customer_id, url)
);
create index if not exists monitored_sites_customer_idx on monitored_sites (customer_id);

-- Funktionen -----------------------------------------------------------------
-- Supabase gibt neuen Funktionen per Default-Privileges EXECUTE an anon;
-- `revoke … from public` entzieht das nicht, daher jeweils auch `from anon`.

-- Atomare Rechnungsnummer: gibt die nächste fortlaufende Zahl zurück und erhöht
-- den Zähler in einem Schritt (Zeilensperre verhindert Doppelvergabe).
create or replace function next_invoice_number()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  update public.settings set naechste_nummer = naechste_nummer + 1
    where id = 1
    returning naechste_nummer - 1 into n;
  return n;
end;
$$;

revoke execute on function next_invoice_number() from public, anon;
grant execute on function next_invoice_number() to authenticated;

-- Rechnungsnummer je Kunde
create or replace function next_invoice_number_for_customer(p_customer_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  update public.customers set rechnung_counter = rechnung_counter + 1
    where id = p_customer_id
    returning rechnung_counter into n;
  return n;
end;
$$;

revoke execute on function next_invoice_number_for_customer(uuid) from public, anon;
grant execute on function next_invoice_number_for_customer(uuid) to authenticated;

-- Rechnung atomar anlegen: Rechnung + Positionen + Zeiteinträge als verrechnet
-- markieren in einer Transaktion (kein Doppelverrechnen bei Teilfehlern).
create or replace function create_invoice_tx(
  p_rechnungsnummer text,
  p_customer_id uuid,
  p_typ invoice_type,
  p_rechnungsdatum date,
  p_leistungsdatum text,
  p_betrag numeric,
  p_notiz text,
  p_mwst_hinweis text,
  p_items jsonb,
  p_time_entry_ids uuid[],
  p_rabatt_prozent numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice_id uuid;
begin
  insert into public.invoices
    (rechnungsnummer, customer_id, typ, status, rechnungsdatum, leistungsdatum,
     betrag, waehrung, notiz, mwst_hinweis, rabatt_prozent)
  values
    (p_rechnungsnummer, p_customer_id, p_typ, 'entwurf', p_rechnungsdatum, p_leistungsdatum,
     p_betrag, 'CHF', p_notiz, p_mwst_hinweis, p_rabatt_prozent)
  returning id into v_invoice_id;

  insert into public.invoice_items
    (invoice_id, position, bezeichnung, menge, einheit, einzelpreis, gesamtpreis)
  select
    v_invoice_id,
    (item->>'position')::int,
    item->>'bezeichnung',
    (item->>'menge')::numeric,
    item->>'einheit',
    (item->>'einzelpreis')::numeric,
    (item->>'gesamtpreis')::numeric
  from jsonb_array_elements(p_items) as item;

  if array_length(p_time_entry_ids, 1) is not null then
    update public.time_entries
      set billed = true, invoice_id = v_invoice_id
      where id = any(p_time_entry_ids);
  end if;

  return v_invoice_id;
end;
$$;

revoke execute on function create_invoice_tx(text, uuid, invoice_type, date, text, numeric, text, text, jsonb, uuid[], numeric) from public, anon;
grant execute on function create_invoice_tx(text, uuid, invoice_type, date, text, numeric, text, text, jsonb, uuid[], numeric) to authenticated;

-- Rechnungsentwurf atomar bearbeiten (Felder + Positionen ersetzen). Nur Entwürfe.
create or replace function update_invoice_tx(
  p_id uuid, p_customer_id uuid, p_typ invoice_type,
  p_rechnungsdatum date, p_leistungsdatum text, p_notiz text,
  p_mwst_hinweis text, p_betrag numeric, p_items jsonb,
  p_rabatt_prozent numeric default 0
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_count int;
begin
  update public.invoices set
    customer_id = p_customer_id, typ = p_typ, rechnungsdatum = p_rechnungsdatum,
    leistungsdatum = p_leistungsdatum, notiz = p_notiz, mwst_hinweis = p_mwst_hinweis,
    betrag = p_betrag, rabatt_prozent = p_rabatt_prozent, updated_at = now()
  where id = p_id and status = 'entwurf';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'invoice % not editable (not a draft or not found)', p_id;
  end if;
  delete from public.invoice_items where invoice_id = p_id;
  insert into public.invoice_items (invoice_id, position, bezeichnung, menge, einheit, einzelpreis, gesamtpreis)
  select p_id, (item->>'position')::int, item->>'bezeichnung', (item->>'menge')::numeric,
    item->>'einheit', (item->>'einzelpreis')::numeric, (item->>'gesamtpreis')::numeric
  from jsonb_array_elements(p_items) as item;
end;
$$;

revoke execute on function update_invoice_tx(uuid, uuid, invoice_type, date, text, text, text, numeric, jsonb, numeric) from public, anon;
grant execute on function update_invoice_tx(uuid, uuid, invoice_type, date, text, text, text, numeric, jsonb, numeric) to authenticated;

-- Offertnummer je Kunde
create or replace function next_quote_number_for_customer(p_customer_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  update public.customers set offerte_counter = offerte_counter + 1
    where id = p_customer_id
    returning offerte_counter into n;
  return n;
end;
$$;

-- Offerte atomar anlegen (p_id null) oder als Entwurf ersetzen, inkl. Positionen.
create or replace function save_quote_tx(
  p_id uuid,
  p_offertnummer text,
  p_customer_id uuid,
  p_offertdatum date,
  p_gueltig_bis date,
  p_betrag numeric,
  p_rabatt_prozent numeric,
  p_notiz text,
  p_mwst_hinweis text,
  p_items jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_count int;
begin
  if v_id is null then
    insert into public.quotes
      (offertnummer, customer_id, offertdatum, gueltig_bis, betrag, rabatt_prozent, notiz, mwst_hinweis)
    values
      (p_offertnummer, p_customer_id, p_offertdatum, p_gueltig_bis, p_betrag, p_rabatt_prozent, p_notiz, p_mwst_hinweis)
    returning id into v_id;
  else
    update public.quotes set
      customer_id = p_customer_id, offertdatum = p_offertdatum, gueltig_bis = p_gueltig_bis,
      betrag = p_betrag, rabatt_prozent = p_rabatt_prozent, notiz = p_notiz,
      mwst_hinweis = p_mwst_hinweis, updated_at = now()
    where id = v_id and status = 'entwurf';
    get diagnostics v_count = row_count;
    if v_count = 0 then
      raise exception 'quote % not editable (not a draft or not found)', v_id;
    end if;
    delete from public.quote_items where quote_id = v_id;
  end if;

  insert into public.quote_items (quote_id, position, bezeichnung, menge, einheit, einzelpreis, gesamtpreis)
  select v_id, (item->>'position')::int, item->>'bezeichnung', (item->>'menge')::numeric,
    item->>'einheit', (item->>'einzelpreis')::numeric, (item->>'gesamtpreis')::numeric
  from jsonb_array_elements(p_items) as item;

  return v_id;
end;
$$;

revoke execute on function next_quote_number_for_customer(uuid) from public, anon;
grant execute on function next_quote_number_for_customer(uuid) to authenticated;
revoke execute on function save_quote_tx(uuid, text, uuid, date, date, numeric, numeric, text, text, jsonb) from public, anon;
grant execute on function save_quote_tx(uuid, text, uuid, date, date, numeric, numeric, text, text, jsonb) to authenticated;

-- Steht der angemeldete Benutzer auf der Admin-Liste? (für die App, unabhängig vom Code)
create or replace function public.is_admin_user()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid())
$$;

-- Darf er an die Daten? Admin und – falls ein zweiter Faktor eingerichtet ist – mit Code angemeldet (aal2).
create or replace function public.has_admin_access()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_admin_user() and (
    coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'
    )
  )
$$;

revoke execute on function public.is_admin_user() from public, anon;
revoke execute on function public.has_admin_access() from public, anon;
grant execute on function public.is_admin_user() to authenticated;
grant execute on function public.has_admin_access() to authenticated;

-- Row Level Security ---------------------------------------------------------
alter table customers       enable row level security;
alter table settings        enable row level security;
alter table invoices        enable row level security;
alter table invoice_items   enable row level security;
alter table time_entries    enable row level security;
alter table quotes          enable row level security;
alter table quote_items     enable row level security;
alter table expenses        enable row level security;
alter table admin_users     enable row level security;
alter table time_reports    enable row level security;
alter table monitored_sites enable row level security;

create policy "admin_all_customers" on customers for all to authenticated
  using ((select public.has_admin_access())) with check ((select public.has_admin_access()));
create policy "admin_all_settings" on settings for all to authenticated
  using ((select public.has_admin_access())) with check ((select public.has_admin_access()));
create policy "admin_all_invoices" on invoices for all to authenticated
  using ((select public.has_admin_access())) with check ((select public.has_admin_access()));
create policy "admin_all_invoice_items" on invoice_items for all to authenticated
  using ((select public.has_admin_access())) with check ((select public.has_admin_access()));
create policy "admin_all_time_entries" on time_entries for all to authenticated
  using ((select public.has_admin_access())) with check ((select public.has_admin_access()));
create policy "admin_all_quotes" on quotes for all to authenticated
  using ((select public.has_admin_access())) with check ((select public.has_admin_access()));
create policy "admin_all_quote_items" on quote_items for all to authenticated
  using ((select public.has_admin_access())) with check ((select public.has_admin_access()));
create policy "admin_all_expenses" on expenses for all to authenticated
  using ((select public.has_admin_access())) with check ((select public.has_admin_access()));
create policy "admin_all_time_reports" on time_reports for all to authenticated
  using ((select public.has_admin_access())) with check ((select public.has_admin_access()));
create policy "admin_all_monitored_sites" on monitored_sites for all to authenticated
  using ((select public.has_admin_access())) with check ((select public.has_admin_access()));

-- Belege: privater Bucket, nur für Admins (Abruf über kurzlebige signierte Links) ---
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expense-receipts', 'expense-receipts', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "admin_read_expense_receipts" on storage.objects for select to authenticated
  using (bucket_id = 'expense-receipts' and (select public.has_admin_access()));
create policy "admin_upload_expense_receipts" on storage.objects for insert to authenticated
  with check (bucket_id = 'expense-receipts' and (select public.has_admin_access()));
create policy "admin_update_expense_receipts" on storage.objects for update to authenticated
  using (bucket_id = 'expense-receipts' and (select public.has_admin_access()));
create policy "admin_delete_expense_receipts" on storage.objects for delete to authenticated
  using (bucket_id = 'expense-receipts' and (select public.has_admin_access()));

-- Rechte auf das Nötige beschränken (zusätzlich zu RLS) ------------------------
-- anon (ohne Anmeldung) bekommt keine Tabellenrechte; TRUNCATE, TRIGGER und
-- REFERENCES umgehen RLS bzw. braucht die App nicht.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke all on table public.%I from anon', t);
    execute format('revoke truncate, trigger, references on table public.%I from authenticated', t);
  end loop;
end $$;
revoke all on admin_users from anon, authenticated;

-- Neue Tabellen und Funktionen bekommen für anon künftig keine Rechte mehr automatisch –
-- für die Rollen, unter denen Migrationen laufen können: postgres und, je nach Installation,
-- supabase_admin. Fehlt die Berechtigung für supabase_admin, wird dieser Teil übersprungen.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
do $$
begin
  alter default privileges for role supabase_admin in schema public revoke all on tables from anon;
  alter default privileges for role supabase_admin in schema public revoke execute on functions from anon;
exception when insufficient_privilege then
  raise notice 'Default-Privileges für supabase_admin übersprungen (keine Berechtigung)';
end $$;
