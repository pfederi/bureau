# Architektur (arc42)

Diese Dokumentation folgt der Vorlage [arc42](https://arc42.org). Sie beschreibt, wie die App aufgebaut ist, warum, und was beim Weiterentwickeln zu beachten ist. Die Bedienung steht in der [Anleitung](anleitung.md).

## 1. Einführung und Ziele

### Aufgabenstellung

Eine selbst gehostete Web-App für Selbständige in der Schweiz: Kunden, Zeiterfassung, Offerten, Rechnungen mit QR-Zahlteil, Ausgaben mit Belegen, Jahresabschluss und Steuerpaket. Kunden bekommen einen privaten Link mit ihren Rechnungen, Stunden und Offerten. Alles läuft in einer Next.js-App mit einer eigenen Supabase-Datenbank – die Daten bleiben beim Betreiber.


### Qualitätsziele

| Priorität | Ziel | Bedeutung |
|---|---|---|
| 1 | **Sicherheit und Datenschutz** | Geschäfts- und Kundendaten sind nur nach Anmeldung mit zweitem Faktor zugänglich; öffentliche Wege (Kundenlink, Cron, Webhooks) sind eng begrenzt. |
| 2 | **Korrekte Beträge** | Rechnungen, QR-Zahlteil, Guthaben und Abschluss stimmen auf den Rappen; Beträge nach den Schreibweisungen der Bundeskanzlei. |
| 3 | **Wartbarkeit** | Reine Logik in getesteten Funktionen, kleine Bausteine, ein Check vor jedem Commit. |
| 4 | **Barrierefreiheit** | WCAG 2.2 AA im Admin und auf der Kundenseite. |
| 5 | **Einfacher Betrieb** | Ein Container, eine Datenbank, wenige Umgebungsvariablen. |

### Stakeholder

| Rolle | Erwartung |
|---|---|
| Betreiber (Admin) | schnelle, verlässliche Verwaltung; keine Buchhaltungskenntnisse nötig |
| Kunden | privater Link mit Rechnungen, Stunden, Offerten; Offerten annehmen oder ablehnen |
| Treuhänder/Steuern | Jahresabschluss, Belege und Rechnungen als Paket |
| Entwickler (inkl. Claude Code) | klare Konventionen (`CLAUDE.md`), Tests, automatische Prüfungen |

## 2. Randbedingungen

- **Technik:** Next.js 16 (App Router, Server-Modus, Turbopack), React 19, Tailwind CSS 4, shadcn/ui, TypeScript, Supabase (Postgres, Auth, Storage), Node ≥ 20.9.
- **Sprache und Formate:** Oberfläche Deutsch (Schweiz, «ss»), Datum `07.10.2026`, Beträge `Fr. 12 500.40` nur über `formatChf`/`formatBetrag` (`src/lib/invoices/stats.ts`).
- **QR-Rechnung:** Swiss QR Bill über `swissqrbill`, PDF über `pdfkit` (Helvetica-Standardschriften, zur Laufzeit von der Festplatte gelesen).
- **Sicherheit:** Row Level Security auf allen Tabellen, neue Funktionen ohne Rechte für `anon`, öffentliche Routen nur mit eigener Prüfung (siehe 8).
- **Barrierefreiheit:** WCAG 2.2 AA; Kontraste werden automatisch geprüft (`tests/a11yContrast.test.ts`).
- **Animationen:** nur mit `motion-safe:`, höchstens 300 ms (Balken 700 ms), ohne Dauerschleife.

## 3. Kontextabgrenzung

```text
                 ┌──────────────────────────────────────────────┐
  Admin ───────▶ │                                              │ ──▶ Supabase (Postgres, Auth, Storage)
  (Browser, 2FA) │                                              │
                 │              Next.js-App (Node)              │ ──▶ Resend (Mails senden, Belege empfangen)
  Kunde ───────▶ │   Admin · Kundenlink · API · Cron · Webhook  │ ──▶ Groq (Belege auslesen, optional)
  (privater Link)│                                              │ ──▶ EZB-Kurse (Frankfurter API)
                 │                                              │ ──▶ überwachte Kunden-Websites (HTTP, TLS, RDAP)
  Cron-Dienst ─▶ │                                              │
  Resend-Webhook▶│                                              │
                 └──────────────────────────────────────────────┘
```

| Partner | Richtung | Zweck |
|---|---|---|
| Supabase | ausgehend | Daten (RLS), Anmeldung mit TOTP/Passkey, Belege und Bilder im Storage |
| Resend | beide | Rechnungen, Erinnerungen, Wochenmail, Alarme senden; weitergeleitete Belege empfangen (Webhook `POST /api/inbound/belege`) |
| Groq | ausgehend | Vorschlag für Ausgaben aus PDF-Text oder Bild (nur mit `GROQ_API_KEY`) |
| Frankfurter (EZB) | ausgehend | Tageskurs EUR/USD für Ausgaben |
| Cron-Dienst | eingehend | `GET /api/cron/wochenmail`, `GET /api/cron/ueberwachung` mit `CRON_SECRET` |
| Kunden-Websites | ausgehend | Erreichbarkeit, SSL-Zertifikat, Domain-Ablauf |

## 4. Lösungsstrategie

- **Eine App, Server-Komponenten zuerst:** Seiten laden Daten auf dem Server (Supabase mit dem Cookie des Benutzers, RLS greift). Client-Komponenten nur für Interaktion; sie importieren nie Server-Module.
- **Reine Logik getrennt:** Berechnungen (Beträge, Guthaben, Todos, Auswertung, Ansätze, Signaturen …) liegen als reine Funktionen in `src/lib/` und sind mit Vitest getestet (`tests/`). Datenzugriff in `src/lib/db/`, Server-Aktionen und Routen sind dünn.
- **Sicherheit in Schichten:** Proxy (`src/proxy.ts`) leitet nicht Angemeldete um und meldet nach Inaktivität ab; jede Server-Aktion und Admin-Route prüft zusätzlich `requireSession()`; die Datenbank erzwingt RLS. Der Service-Key wird nur auf dem Server und nur für die eng begrenzten öffentlichen Wege genutzt.
- **Editionen über eine Datei:** Unterschiede zwischen Instanzen (Name, Logo, Website, Material, Release Notes …) stehen nur in `src/edition.ts`.
- **Prüfen vor jedem Commit:** `npm run check` (Typen, Tests, `npm audit`, Login-Schutz, Migrationsregeln, Geheimnisse im Browser-Code, Aufräumen); ein Git-Hook verhindert Commits bei rotem Check.


## 5. Bausteinsicht

### Ebene 1

| Baustein | Ort | Verantwortung |
|---|---|---|
| Admin | `src/app/admin/` | Dashboard, Zeiterfassung, Kunden, Rechnungen, Offerten, Ausgaben, Auswertung, Einstellungen, Anleitung |
| Kundenlink | `src/app/kunde/[token]/` | private Kundenseite mit Rechnungs- und Offerten-PDF, Antwort auf Offerten |
| API | `src/app/api/` | Admin-Routen (Upload, Export, PDF, Mailversand), Cron, eingehende Webhooks |
| Logik | `src/lib/` | reine Funktionen und Datenzugriff (siehe Ebene 2) |
| UI-Grundbausteine | `src/components/ui/` | shadcn/ui |
| Proxy | `src/proxy.ts` | Login-Weiterleitung, automatische Abmeldung, eigene Admin-Adresse (`ADMIN_HOST`) |
| Edition | `src/edition.ts` | Unterschiede zwischen Instanzen |
| Datenbank | `supabase/migrations/` | Schema, RLS, Funktionen |


### Ebene 2: `src/lib/`

| Bereich | Inhalt |
|---|---|
| `invoices/` | Beträge und Formate (`stats.ts`), Rabatt, Hosting, Guthaben, Kundenkonto, Budget, Kundenauswertung |
| `timeEntries/` | Stundenübersicht, Projekte, Ansätze pro Kunde und Projekt, Stundenrapport |
| `expenses/` | Kategorien, Währung, Duplikate, wiederkehrende Belege, Belegerkennung, Abschluss, Rücklage |
| `dashboard/` | Todos |
| `portal/` | Token, Offerten-Zustand, Anrede-Texte, Herkunftsprüfung |
| `inbound/` | Webhook-Signatur, Absender- und Anhangsprüfung, sicherer Download, Verarbeitung der Beleg-Mails |
| `monitoring/` | Website-Überwachung |
| `email/` | Mailtexte und Versand (Resend) |
| `pdf/` | Rechnungs-, Offerten-, Rapport- und Abschluss-PDF |
| `export/` | Datensicherung (ZIP), Steuerpaket |
| `db/` | Datenzugriff je Tabelle; `portal.ts`, `belegEingang.ts` mit Service-Key für die öffentlichen Wege |
| `auth.ts`, `sitzung.ts` | Anmeldestufe (Passwort, zweiter Faktor), Sitzungs-Cookie |

### Datenmodell (Kern)

`customers` · `time_entries` · `project_rates` · `invoices` / `invoice_items` · `quotes` / `quote_items` · `expenses` · `beleg_eingang` · `customer_guthaben` · `monitored_sites` · `time_reports` · `settings` (eine Zeile) · `admin_users`.

## 6. Laufzeitsicht

**Anmeldung:** E-Mail und Passwort (Supabase Auth) → zweiter Faktor (TOTP oder Passkey) hebt die Sitzung auf `aal2` → nur Benutzer in `admin_users` kommen weiter. Der Proxy führt ein signiertes Sitzungs-Cookie und meldet nach 15 Minuten ohne Eingabe bzw. beim Schliessen des Browsers ab.

**Rechnung versenden:** Admin wählt «Senden» → Route rendert das PDF mit QR-Zahlteil → Mail über Resend an den Kunden, Kopie an den Absender → Status «versendet». Guthaben werden angerechnet; ist der Rest 0, gilt die Rechnung sofort als bezahlt.

**Offerte im Kundenlink beantworten:** Kunde öffnet `/kunde/<token>` → Karte «Offerten» → Name und Bestätigung → `POST /kunde/<token>/offerte/<id>/antwort` prüft Token, Herkunft und Eingaben → **ein** bedingtes Update (nur eigene, versendete, in Zürcher Zeit gültige Offerte) → Mail an den Admin nach der Antwort (`after()`) → Todo «In Rechnung umwandeln».

**Beleg per Mail:** Admin leitet eine Rechnung an die Empfangsadresse weiter → Resend ruft `POST /api/inbound/belege` mit Svix-Signatur auf → Signatur und Absender geprüft, sofort 200 → in `after()`: Anhänge über die Resend-API laden (nur von Resends Download-Servern, Grösse begrenzt), im Storage ablegen, mit Groq auslesen, Eintrag in `beleg_eingang` → Admin prüft im Dialog «Neue Ausgabe» und speichert.

**Wochenmail und Überwachung:** Der Cron-Dienst ruft die Cron-Routen mit `CRON_SECRET` auf; sie lesen mit dem Service-Key, berechnen Todos bzw. prüfen Websites und schicken Mails über Resend.

## 7. Verteilungssicht

Ein Container mit dem Node-Server (Next.js `output: 'standalone'`, `node server.js`, Port 3000) und eine Supabase-Instanz (selbst gehostet oder Supabase Cloud).

- **Image:** mehrstufiges `Dockerfile` (Abhängigkeiten → `next build` → schlankes Laufzeit-Image mit Server, `public/`, `docs/` und `curl` für Healthchecks). `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` werden beim Build eingebaut, alle übrigen Variablen zur Laufzeit gesetzt.
- **Laufzeitdateien:** Die Anleitung und die Release Notes werden aus `docs/` gelesen, die PDF-Schriften aus `node_modules/pdfkit/js/data` (in `next.config.js` fürs Tracing mitgenommen).
- **Geplante Aufgaben:** Wochenmail (Montag 07:00) und Überwachung (alle 15 Minuten) über einen Cron-Dienst, z. B. als geplante Aufgabe der Hosting-Plattform.
- **Varianten:** Docker, Vercel oder Node-Server – Schritt für Schritt in der Einrichtungsanleitung.


## 8. Querschnittliche Konzepte

**Sicherheit**
- Öffentlich ohne Login nur: die Kundenseite `/kunde/[token]` (Service-Key, immer auf den Kunden des Tokens beschränkt), `/api/cron/*` (`CRON_SECRET`) und `/api/inbound/*` (Webhook-Signatur, `RESEND_WEBHOOK_SECRET`). Alles andere prüft `requireSession()`; `npm run check` erzwingt das für Routen und Server-Aktionen.
- RLS auf allen Tabellen mit Policy `has_admin_access()`, keine Rechte für `anon`.
- Öffentliche Schreibwege: einmalige, bedingte Updates; Eingaben mit zod begrenzt; HTML in Mails escaped; Downloads nur von festen Hosts ohne Weiterleitungen.
- Sicherheits-Header (HSTS, `frame-ancestors`, `noindex` für Admin und Kundenlink) in `next.config.js`.

**Beträge und Datum:** zentral formatiert (`stats.ts`); Rappen-genaues Runden; Daten in Zürcher Zeit, wo es fachlich zählt (Gültigkeit von Offerten, Zahlungsdauer).

**Fehlerbehandlung:** Server-Aktionen geben `{ ok, error }` zurück statt zu werfen; die Oberfläche zeigt Toasts. Was nach einem erfolgreichen Speichern scheitert (Mail, Aufräumen), wird nur geloggt – nie als «nicht gespeichert» gemeldet.

**Barrierefreiheit und Bewegung:** Labels für alle Felder, Fokus sichtbar, Status nie nur über Farbe, `aria-live` für Meldungen; Mikroanimationen nur mit `motion-safe` (gespeicherte Zeile leuchtet, Status ploppt, Beträge zählen).

**Tests und Prüfungen:** Vitest für reine Logik (`tests/`), `npm run check` vor jedem Commit, Sicherheits-Review bei geänderten sicherheitsrelevanten Dateien.

**Datensicherung:** ZIP mit allen Tabellen als JSON/CSV, Belegen und Rechnungs-PDF (Einstellungen).

## 9. Architekturentscheidungen

| Entscheidung | Begründung |
|---|---|
| Next.js im Server-Modus statt statischem Export | Admin, Kundenlink, PDFs und Cron brauchen Server-Code |
| Supabase mit RLS | Auth mit zweitem Faktor, Postgres und Storage aus einer Hand; Sicherheit auch in der Datenbank |
| Öffentliche Schreibwege als Route Handler statt Server-Aktion | Server-Aktionen müssen zuerst `requireSession()` prüfen; Routen prüfen Token bzw. Signatur selbst |
| Webhook-Signatur selbst geprüft (Svix-Standard), Resend-API per `fetch` | kein grosser SDK-Versionssprung, der den Rechnungsversand berührt |
| Eingang für Belege statt automatisch gespeicherter Ausgaben | Abschluss und Rücklage enthalten nur geprüfte Beträge |
| Ansätze explizit (Kunde, Projekt) statt «letzter Satz» | durchschaubar; offene Einträge ziehen nur nach Rückfrage mit |
| Jeder Zeiteintrag speichert seinen Satz | verrechnete Beträge bleiben korrekt, keine Ansätze mit Gültigkeitsdatum nötig |
| Standalone-Image | kleines Laufzeit-Image, weniger Speicher im Betrieb |


Ausführliche Entwürfe mit Begründungen liegen als Specs und Pläne im Entwicklungsrepo.

## 10. Qualitätsanforderungen

| Szenario | Erwartung |
|---|---|
| Ein Kunde ruft mit seinem Token eine Offerte eines anderen Kunden auf | 404/409, keine fremden Daten, nichts geändert |
| Zwei Klicks auf «Offerte annehmen» | genau eine Antwort gespeichert |
| Webhook ohne gültige Signatur | 401, kein Abruf bei Resend, nichts gespeichert |
| Rechnung mit Guthaben | QR-Zahlteil über den Rest, Rappen-genau |
| «Bewegung reduzieren» eingeschaltet | keine Animationen, Hervorhebung ohne Übergang |
| Neue Migration vergessen | Seiten mit Zusatzdaten laden trotzdem (Fehler nur geloggt), Speichern betroffener Felder schlägt sichtbar fehl |

## 11. Risiken und technische Schulden

- **Grosse Datenmengen:** Einige Übersichten (Auswertung «Alle Jahre», Dashboard) laden alle Zeiteinträge ohne Paging; bei mehr als rund 1000 Einträgen greift die Zeilengrenze der Datenbank-API.
- **Fremdwährung bei Rechnungen:** EUR-Rechnungen werden in Übersichten wie Franken summiert.
- **Externe Dienste:** Ändert Resend Hosts oder API (z. B. Download-Server der Anhänge), muss die Allowlist nachgeführt werden; Groq-Ausfälle führen nur zu leeren Vorschlägen.
- **Build braucht Google Fonts:** `next/font/google` lädt die Schrift beim Build; ein Netzproblem lässt den Build scheitern (erneut starten).
- **Keine Oberflächen-Tests:** Interaktionen (Dialoge, Fokus, Animationen) sind nicht automatisch getestet, nur die reine Logik.

## 12. Glossar

| Begriff | Bedeutung |
|---|---|
| Kundenlink | private Seite `/kunde/<token>` für einen Kunden, ohne Login |
| Ansatz | Stundensatz; Vorschlag aus Projekt, Kunde oder Standard |
| Guthaben | Überzahlung eines Kunden, wird an Rechnungen angerechnet |
| Eingang | per Mail weitergeleitete, noch nicht geprüfte Belege |
| Todo | Hinweis im Dashboard und in der Wochenmail, was liegen geblieben ist |
| Rücklage | geschätzte AHV und Steuern auf den Gewinn |
| Edition | Ausprägung der App (Name, Funktionen) über `src/edition.ts` |
| `aal2` | Anmeldestufe nach dem zweiten Faktor |

