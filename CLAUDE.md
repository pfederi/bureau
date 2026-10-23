# Bureau – Hinweise für Claude

Next.js 16 mit React 19 und Tailwind 4 (App Router, Server-Modus, Turbopack) mit passwortgeschütztem Admin-Bereich unter `/admin` (Rechnungen, Offerten, Zeiterfassung mit Projektfeld, Ausgaben, Kunden). Daten in Supabase.

## Konventionen
- UI-Texte auf Deutsch, Schweizer Schreibweise (ss statt ß). Datum als `07.10.2026` (`formatDatum`).
- **Beträge immer nach den Schreibweisungen der Bundeskanzlei** (Rz. 512–513, 539–546), nie selbst formatieren, sondern `formatChf` / `formatBetrag` / `formatZahl` aus `src/lib/invoices/stats.ts` verwenden:
  - Kürzel `Fr.` vor dem Betrag mit geschütztem Abstand: `Fr. 23.50` (nicht `CHF`, kein Dezimalkomma). `CHF` nur, wo ein Standard es verlangt (QR-Zahlteil).
  - Dreiergruppen mit schmalem geschütztem Abstand, **kein Apostroph**: `Fr. 12 500.40`; vierstellige Zahlen ungetrennt (`Fr. 1250.50`), in Tabellen ebenfalls gegliedert (`{ tabelle: true }`).
  - **Immer zwei Nachkommastellen** (`Fr. 20.00`, `Fr. 0.15`) – bewusste Abweichung vom Gedankenstrich der Bundeskanzlei (Rz. 541), damit Beträge in Listen sauber untereinander stehen.
  - Im PDF (Helvetica ohne U+202F) mit `abstand: ' '`.
  - Formularbeschriftungen: `Betrag (Fr.)`.
- Admin: shadcn/ui, fix dunkel (Klasse `.admin-dark` in `globals.css`, Schrift Sora). Keine hellen Festfarben wie `text-green-700` verwenden. Reine Logik in `src/lib/` mit Vitest-Tests in `tests/`.
- Tailwind 4: Konfiguration in `globals.css` (`@theme inline`, kein `tailwind.config.js`). Eigene CSS-Regeln, die Utilities übersteuern müssen, gehören **ausserhalb** von `@layer` (native Cascade Layers). `space-y-*` setzt jetzt `margin-bottom` und wirkt nicht auf Inline-Elemente.
- Animationen nur mit `motion-safe:` (Einstellung «Bewegung reduzieren»), kurz (≤ 300 ms, Balken ≤ 700 ms) und ohne Dauerschleife; eigene Keyframes als `--animate-*` im `@theme` in `globals.css`. Navigation per `router.push` über `useNavRouter()` (startet den Ladebalken).
- Next 16: `params`, `searchParams` und `cookies()` sind asynchron (`await props.params`); die Login-Weiterleitung steht in `src/proxy.ts` (früher Middleware).
- Neue Migrationen in `supabase/migrations/NNNN_name.sql`; neue Funktionen im `public`-Schema immer zusätzlich `revoke execute … from anon`; neue Tabellen mit RLS und Policy `has_admin_access()`, ohne Rechte für `anon`.
- Öffentlich ohne Login nur: `/kunde/[token]` (Service-Key, immer auf den Kunden des Tokens beschränkt) und `/api/cron/*` (`CRON_SECRET`). Alles andere prüft `requireSession()`.

## Vor jedem Commit
1. Barrierefreiheit nach WCAG 2.2 AA prüfen: Beschriftungen für Felder und Icon-Knöpfe, Tastaturbedienung mit sichtbarem Fokus, Klickflächen ab 24 × 24 px, Status nie nur über Farbe, Seitentitel pro Seite, Meldungen über Toasts oder `aria-live`. Kontraste prüft `tests/a11yContrast.test.ts` automatisch.
2. `npm run check` muss grün sein (Typen, Tests, `npm audit`, Login-Schutz, Migrationen, Geheimnisse) – ein Hook blockiert `git commit` sonst.

## Dev-Server
Nur **einen** `npm run dev` gleichzeitig und nie parallel zu `npm run build` – sie teilen `.next`. Symptom: „missing required error components, refreshing...“ → alle Next-Prozesse beenden, `.next` löschen, einen neu starten.
