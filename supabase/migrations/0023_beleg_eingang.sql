-- supabase/migrations/0023_beleg_eingang.sql
-- Eingang für Belege, die per Mail (Resend Inbound) weitergeleitet werden, und erlaubte Absender.

create table if not exists beleg_eingang (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  mail_id text not null,
  anhang_id text not null,
  absender text not null,
  betreff text,
  beleg_path text,
  beleg_name text,
  vorschlag jsonb not null default '{}'::jsonb,
  hinweis text,
  unique (mail_id, anhang_id)
);
alter table beleg_eingang enable row level security;
drop policy if exists "admin_all_beleg_eingang" on beleg_eingang;
create policy "admin_all_beleg_eingang" on beleg_eingang for all to authenticated
  using ((select public.has_admin_access())) with check ((select public.has_admin_access()));
revoke all on beleg_eingang from anon;

alter table settings add column if not exists beleg_absender text[] not null default '{}';
