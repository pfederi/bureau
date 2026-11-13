-- supabase/migrations/0022_quote_answers.sql
-- Antwort des Kunden auf eine Offerte im Kundenlink (annehmen/ablehnen) und Anrede pro Kunde.

alter table quotes add column if not exists antwort_am timestamptz;
alter table quotes add column if not exists antwort_name text
  check (antwort_name is null or char_length(antwort_name) between 2 and 100);
alter table quotes add column if not exists antwort_grund text
  check (antwort_grund is null or char_length(antwort_grund) <= 1000);
alter table quotes add column if not exists antwort_via text
  check (antwort_via is null or antwort_via in ('kundenlink'));

alter table customers add column if not exists anrede text not null default 'sie'
  check (anrede in ('sie', 'du'));
