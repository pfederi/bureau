/**
 * Steuerpaket pro Jahr: Jahresabschluss (PDF, CSV), Belege der Ausgaben, Rechnungen der
 * Einnahmen und Material-Belege in einem ZIP – für die Steuererklärung oder den Treuhänder.
 * Reine Hilfsfunktionen, das Laden passiert in der Route.
 */
import { formatChf } from '@/lib/invoices/stats'
import { edition, type Edition } from '@/edition'
import { formatDatum } from '@/lib/utils'
import type { YearReport } from '@/lib/expenses/report'
import { cleanDescription } from '@/lib/expenses/recurring'

export function taxPackageFileName(jahr: number): string {
  return `${edition.slug}-steuerunterlagen-${jahr}.zip`
}

const ext = (path: string) => /\.[a-z0-9]{2,5}$/i.exec(path)?.[0].toLowerCase() ?? ''

// Nur Zeichen, die in ZIP-Namen überall gehen (wie safeZipPath): Buchstaben, Ziffern, . _ - und Leerschlag
const sauber = (s: string) => s.normalize('NFC').replace(/[^\p{L}\p{N}. _-]+/gu, ' ').replace(/\s+/g, ' ').trim()

/**
 * Dateiname eines Belegs: Datum, Lieferant, Beschreibung (ohne Rechnungsnummer) und Betrag,
 * damit er sich ohne Liste zuordnen lässt. Gleiche Namen bekommen « 2», « 3» …
 */
export function receiptFileName(
  e: { datum: string; lieferant?: string | null; beschreibung: string; betrag: number; beleg_path: string },
  vergeben: Set<string>,
): string {
  const text = [e.lieferant ?? '', cleanDescription(e.beschreibung) || e.beschreibung].map(sauber).filter(Boolean).join(' - ').slice(0, 70).trim()
  const basis = `${e.datum} ${text} - ${formatChf(Number(e.betrag), { abstand: ' ' }).replace(/\u00A0/g, ' ')}`
  let name = `${basis}${ext(e.beleg_path)}`
  for (let n = 2; vergeben.has(name.toLowerCase()); n++) name = `${basis} ${n}${ext(e.beleg_path)}`
  vergeben.add(name.toLowerCase())
  return name
}

export function taxPackageReadme(input: {
  report: YearReport
  now: Date
  belege: number
  ohneBeleg: { datum: string; beschreibung: string; betrag: number }[]
  rechnungen: number
  material: number
  fehler: string[]
}, ed: Edition = edition): string {
  const { report: r } = input
  const fr = (n: number) => formatChf(n, { abstand: ' ' }).replace(/ /g, ' ')
  const lines = [
    `${ed.name} – Steuerunterlagen ${r.jahr}`,
    `Erstellt am ${formatDatum(input.now.toISOString().slice(0, 10))}`,
    '',
    'Selbständige Erwerbstätigkeit im Nebenerwerb, Einnahmen nach Zahlungseingang.',
    '',
    `Einnahmen  ${fr(r.einnahmenTotal)}`,
    `Ausgaben   ${fr(r.ausgabenTotal)}`,
    `Gewinn     ${fr(r.gewinn)}`,
    '',
    'Inhalt',
    `- Jahresabschluss-${r.jahr}.pdf  Übersicht mit Einnahmen, Ausgaben pro Kategorie und Gewinn`,
    `- Jahresabschluss-${r.jahr}.csv  Alle Buchungen für Excel bzw. das Hilfsblatt A`,
    `- belege/       ${input.belege} Belege der Ausgaben (Datum, Lieferant, Betrag im Namen)`,
    `- rechnungen/   ${input.rechnungen} Rechnungen, die ${r.jahr} ${ed.material ? 'bezahlt oder mit Material verrechnet wurden' : 'bezahlt wurden'}`,
    ...(ed.material && input.material ? [`- material/     ${input.material} Belege zu Material, das Rechnungen gedeckt hat`] : []),
    '',
    'Hinweis: Die Rechnungen sind mit den heutigen Einstellungen neu erzeugt. Massgebend',
    'für die Aufbewahrung (10 Jahre) sind die tatsächlich versendeten Rechnungen.',
  ]
  if (input.ohneBeleg.length) {
    lines.push('', 'Ausgaben ohne Beleg', ...input.ohneBeleg.map(e => `- ${formatDatum(e.datum)}  ${e.beschreibung}  ${fr(e.betrag)}`))
  }
  if (input.fehler.length) lines.push('', 'Nicht enthalten (Fehler beim Laden)', ...input.fehler.map(f => `- ${f}`))
  return lines.join('\r\n') + '\r\n'
}
