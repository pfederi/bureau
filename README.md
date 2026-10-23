# Bureau

Rechnungen, Stunden und Ausgaben für Selbständige in der Schweiz – selbst gehostet, deine Daten bleiben bei dir.

<!-- ![Dashboard von Bureau mit Beispieldaten](docs/images/dashboard.png) -->

## Funktionen

- **Rechnen:** Rechnungen mit QR-Zahlteil (PDF), Offerten, Zahlungserinnerungen, Storno, Hosting-Sammelrechnungen
- **Erfassen:** Zeiterfassung mit Projekten und Stundenbudget, Ausgaben mit Belegen und automatischer Belegerkennung
- **Überblick:** Dashboard mit Todos, offenen Beträgen, Steuer-Rücklage, Jahresabschluss und Steuerpaket als ZIP
- **Kunden:** Kundenportal mit Rechnungen und Stundenrapporten, Website-Überwachung mit Alarm
- **Automatisch:** Wochenübersicht per Mail jeden Montag
- **Sicher:** Pflicht-Zwei-Faktor (Authenticator oder Passkey), Row Level Security, automatische Abmeldung, Datensicherung als ZIP

## Für wen

Für eine Person mit Schweizer Bankkonto, die selbständig arbeitet. Oberfläche auf Deutsch, Beträge in Franken nach den Schreibweisungen der Bundeskanzlei (`Fr. 12 500.40`). Pro Installation gibt es genau einen Admin.

## Schnellstart

1. Repo forken oder klonen, `npm ci`
2. Supabase-Projekt anlegen und `supabase/migrations/` einspielen
3. `.env.example` nach `.env.local` kopieren und ausfüllen
4. Ersten Admin anlegen ([SQL-Snippet in der Einrichtungsanleitung](docs/setup.md#3-erster-admin))
5. `npm run dev`, unter `/admin` anmelden, Zwei-Faktor einrichten, Einstellungen ausfüllen

Die ausführliche Anleitung mit Deployment und Cron-Jobs steht in [docs/setup.md](docs/setup.md). Die Bedienung erklärt [docs/anleitung.md](docs/anleitung.md) (auch im Admin unter «Anleitung»).

## Technik

Next.js 16, React 19, Tailwind 4, shadcn/ui, Supabase (Postgres, Auth, Storage).

| Dienst | Wofür | |
|---|---|---|
| Supabase | Datenbank, Anmeldung, Belege | Pflicht |
| Resend | Mailversand | optional |
| Groq | Belegerkennung | optional |

Ohne Resend lassen sich Rechnungen als PDF herunterladen und selbst versenden; die Cron-Jobs (Wochenmail, Website-Überwachung) laufen weiter, verschicken aber keine Mail. Ohne Groq erfasst du Ausgaben von Hand.

## Entwicklung

```bash
npm run dev     # Entwicklungsserver
npm run check   # Typen, Tests, npm audit, Login-Schutz, Migrationen, Geheimnisse
```

Konventionen für Mitarbeit (auch mit KI-Assistenten) stehen in [CLAUDE.md](CLAUDE.md).

## Fehler, Ideen und Sicherheit

- **Fehler melden** oder **Idee vorschlagen** über die Formulare unter [Issues](https://github.com/pfederi/bureau/issues/new/choose).
- **Sicherheitslücken** bitte vertraulich melden, nicht als Issue – siehe [SECURITY.md](SECURITY.md).

## Lizenz

[Functional Source License 1.1, MIT Future License](LICENSE). Du darfst Bureau frei nutzen – auch für dein eigenes Geschäft –, anpassen und weitergeben. Nicht erlaubt ist, Bureau zu verkaufen oder als Dienst für andere anzubieten. Zwei Jahre nach Veröffentlichung wird jede Version zu MIT.

Du willst Bureau weiterverkaufen oder als Dienst anbieten? Melde dich – das lässt sich regeln: [Issue eröffnen](https://github.com/pfederi/bureau/issues).

© 2026 Patrick Federi
