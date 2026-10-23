# Bureau einrichten

Diese Anleitung führt von einem leeren Supabase-Projekt bis zur laufenden Installation. Den Quellcode findest du unter github.com/pfederi/bureau.

## 1. Voraussetzungen

- Node 22
- Ein Supabase-Projekt (supabase.com oder selbst gehostet)
- Optional: Resend (Mailversand) und Groq (Belegerkennung)
- Für den Betrieb: Hosting mit Docker (zum Beispiel Coolify, Fly.io, Render) oder ein Node-Server

## 2. Datenbank

Am einfachsten im SQL-Editor von Supabase: alle Dateien in `supabase/migrations/` nach Dateinamen sortiert der Reihe nach ausführen, angefangen mit `0000_baseline.sql`.

Alternativ mit der Supabase-CLI. Ein frischer Klon enthält noch keine `supabase/config.toml`; `supabase init` legt sie an (die Migrationen bleiben unverändert, die Datei darfst du committen):

```bash
supabase init
supabase link --project-ref <ref>
supabase db push
```

Bei selbst gehostetem Supabase statt `link` die Datenbank direkt angeben: `supabase db push --db-url "postgresql://postgres:<passwort>@<host>:5432/postgres"`.

### Zwei-Faktor im Auth-Dienst aktivieren

Bureau verlangt bei jedem Login einen Code. Dafür muss der Auth-Dienst von Supabase Zwei-Faktor (MFA) erlauben:

- **supabase.com:** TOTP ist standardmässig aktiv, nichts zu tun.
- **Supabase-CLI (lokal oder verknüpft):** Das von `supabase init` erzeugte `supabase/config.toml` schaltet TOTP aus. Ohne Änderung kann sich niemand anmelden. Beide Werte auf `true` setzen und die Konfiguration übernehmen (lokal `supabase stop` und `supabase start`, bei einem verknüpften Projekt `supabase config push`):

  ```toml
  [auth.mfa.totp]
  enroll_enabled = true
  verify_enabled = true
  ```

- **Passkeys (optional):** Zusätzlich in `supabase/config.toml`:

  ```toml
  [auth.mfa.web_authn]
  enroll_enabled = true
  verify_enabled = true
  ```

  Bei selbst gehostetem Supabase mit Docker stehen die Schalter beim Auth-Dienst (GoTrue) als Umgebungsvariablen, für Passkeys `GOTRUE_MFA_WEB_AUTHN_ENROLL_ENABLED=true` und `GOTRUE_MFA_WEB_AUTHN_VERIFY_ENABLED=true`; die Variablen für TOTP stehen im gleichen Schema in der Dokumentation des Auth-Dienstes. Danach den Auth-Dienst neu starten. Passkeys gelten pro Domain, richte sie auf der Domain ein, unter der Bureau läuft.

## 3. Erster Admin

1. In Supabase unter Authentication einen Benutzer mit E-Mail und Passwort anlegen.
2. Im SQL-Editor als Admin eintragen:

   ```sql
   insert into admin_users (user_id, email)
   select id, email from auth.users where email = 'du@example.ch';
   ```

3. Die Registrierung in Supabase deaktivieren (Authentication → Sign In / Providers → «Allow new users to sign up» ausschalten).

Beim ersten Login verlangt Bureau die Einrichtung von Zwei-Faktor (Authenticator-App oder Passkey).

## 4. Umgebungsvariablen

Kopiere `.env.example` nach `.env.local` und fülle die Werte aus.

| Variable | Pflicht | Zweck |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ja | Adresse des Supabase-Projekts |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ja | öffentlicher Schlüssel (anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | ja | Service-Schlüssel, nur auf dem Server, nie im Browser |
| `APP_URL` | ja | öffentliche Adresse der App (Links in Mails, Kundenportal) |
| `CRON_SECRET` | ja, für Cron-Jobs | zufälliger Wert, mindestens 16 Zeichen |
| `RESEND_API_KEY` | optional | Mailversand über Resend |
| `INVOICE_FROM_EMAIL` | optional | überschreibt den Absender aus den Einstellungen, Form `Vorname Name <rechnung@example.ch>` |
| `GROQ_API_KEY` | optional | automatische Belegerkennung |
| `GROQ_MODEL` | optional | Modell für die Belegerkennung |

`NEXT_PUBLIC_*`-Variablen müssen beim Build gesetzt sein, nicht erst beim Start. Bei Docker gibst du sie als Build-Args mit.

## 5. Deployment

Im Repo liegt ein `Dockerfile`. Die App lauscht auf Port 3000. Beim Bauen brauchst du die Build-Args `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY`; die übrigen Variablen setzt du als Umgebungsvariablen des laufenden Containers.

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key> \
  -t bureau .
docker run -p 3000:3000 --env-file .env.local bureau
```

Ohne Docker: `npm ci`, `npm run build`, `npm run start`.

## 6. Cron-Jobs

Zwei Aufgaben laufen zeitgesteuert. Beide sind `GET`-Aufrufe und brauchen den Header `Authorization: Bearer <CRON_SECRET>`.

| Aufgabe | Pfad | Takt |
|---|---|---|
| Wochenmail | `/api/cron/wochenmail` | montags 07:00 |
| Website-Überwachung | `/api/cron/ueberwachung` | alle 15 Minuten |

Beispiel:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://admin.example.ch/api/cron/wochenmail
```

Eingetragen wird das im Planer deines Hostings (zum Beispiel «Scheduled Tasks») oder in einem Cron-Dienst.

Ohne `RESEND_API_KEY` laufen beide Aufgaben trotzdem, verschicken aber keine Mail: Die Überwachung prüft die Websites und speichert den Zustand (sichtbar im Admin), die Antwort enthält den Hinweis «Mail deaktiviert (RESEND_API_KEY fehlt)».

## 7. Einstellungen

Nach dem ersten Login unter «Einstellungen» ausfüllen: Absender, Adresse, IBAN (QR-IBAN oder normale IBAN), Stundensatz, MWST-Hinweis und die nächste Rechnungsnummer.

## 8. Updates

1. Neue Version holen (`git pull`, bzw. Fork synchronisieren).
2. Neue Migrationen mit `supabase db push` einspielen (oder die neuen Dateien im SQL-Editor ausführen).
3. Neu deployen.

Mach vorher eine Datensicherung (Einstellungen → Datensicherung herunterladen).

## 9. Zwei-Faktor zurücksetzen

Hast du alle Geräte für die Zwei-Faktor-Anmeldung verloren (Authenticator-App und Passkeys), löschst du die Faktoren im SQL-Editor von Supabase. Statt `du@example.ch` deine Login-Adresse einsetzen:

```sql
delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'du@example.ch');
```

Beim nächsten Login verlangt Bureau die Einrichtung von Zwei-Faktor neu.

## Fehlerbehebung

- **Code-Eingabe schlägt fehl oder die Einrichtung meldet, MFA sei nicht aktiviert:** Im Auth-Dienst ist TOTP ausgeschaltet. Siehe «Zwei-Faktor im Auth-Dienst aktivieren» in Abschnitt 2 (`enroll_enabled` und `verify_enabled` auf `true`, Dienst neu starten).
