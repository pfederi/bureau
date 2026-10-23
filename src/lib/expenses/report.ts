import type { Expense, ExpenseCategory, Invoice } from '@/lib/types'
import { EXPENSE_CATEGORIES } from './categories'
import { csvCell } from '@/lib/export/csv'

type ReportInvoice = Pick<Invoice, 'id' | 'rechnungsnummer' | 'rechnungsdatum' | 'betrag' | 'status' | 'paid_at' | 'verrechnung_material'>
  & { customer?: { firma_oder_name: string } | null }

export type IncomeRow = { datum: string; rechnungsnummer: string; kunde: string; betrag: number; art: 'Zahlung' | 'Material' }
export type OpenRow = { rechnungsnummer: string; kunde: string; rechnungsdatum: string; betrag: number }
export type CategoryTotal = { kategorie: ExpenseCategory; label: string; betrag: number; anzahl: number }

export type YearReport = {
  jahr: number
  einnahmen: IncomeRow[]
  ausgaben: Expense[]
  proKategorie: CategoryTotal[]
  einnahmenTotal: number
  ausgabenTotal: number
  gewinn: number
  /** Am 31.12. offen: verrechnet, aber erst im Folgejahr (oder noch gar nicht) bezahlt */
  offenAmJahresende: OpenRow[]
}

const round2 = (n: number) => Math.round(n * 100) / 100
const sum = (xs: number[]) => round2(xs.reduce((s, x) => s + x, 0))

/** AHV: Beiträge auf geringfügigem selbständigem Nebenerwerb nur auf Verlangen bis zu dieser Grenze. */
export function ahvGrenze(jahr: number): number {
  return jahr >= 2026 ? 2500 : 2300
}

/**
 * Jahresabschluss nach Zahlungseingang (Ist-Methode): Einnahmen sind Rechnungen,
 * die im Jahr bezahlt oder per Material gedeckt wurden; Stornierte zählen nie.
 */
export function computeYearReport(invoices: ReportInvoice[], expenses: Expense[], jahr: number): YearReport {
  const y = String(jahr)
  const kunde = (i: ReportInvoice) => i.customer?.firma_oder_name ?? ''

  const einnahmen: IncomeRow[] = invoices
    .filter(i => i.status === 'bezahlt' && i.paid_at?.slice(0, 4) === y)
    .map(i => ({
      datum: i.paid_at!.slice(0, 10),
      rechnungsnummer: i.rechnungsnummer,
      kunde: kunde(i),
      betrag: Number(i.betrag),
      art: (i.verrechnung_material ? 'Material' : 'Zahlung') as IncomeRow['art'],
    }))
    .sort((a, b) => a.datum.localeCompare(b.datum))

  const offenAmJahresende: OpenRow[] = invoices
    .filter(i => (i.status === 'versendet' || i.status === 'bezahlt') && i.rechnungsdatum <= `${y}-12-31`)
    .filter(i => i.status === 'versendet' || (i.paid_at !== null && i.paid_at.slice(0, 4) > y))
    .map(i => ({ rechnungsnummer: i.rechnungsnummer, kunde: kunde(i), rechnungsdatum: i.rechnungsdatum, betrag: Number(i.betrag) }))
    .sort((a, b) => a.rechnungsdatum.localeCompare(b.rechnungsdatum))

  const ausgaben = expenses.filter(e => e.datum.startsWith(y)).sort((a, b) => a.datum.localeCompare(b.datum))
  const proKategorie = EXPENSE_CATEGORIES
    .map(c => {
      const items = ausgaben.filter(e => e.kategorie === c.value)
      return { kategorie: c.value, label: c.label, betrag: sum(items.map(e => Number(e.betrag))), anzahl: items.length }
    })
    .filter(c => c.anzahl > 0)

  const einnahmenTotal = sum(einnahmen.map(e => e.betrag))
  const ausgabenTotal = sum(ausgaben.map(e => Number(e.betrag)))
  return { jahr, einnahmen, ausgaben, proKategorie, einnahmenTotal, ausgabenTotal, gewinn: round2(einnahmenTotal - ausgabenTotal), offenAmJahresende }
}

/** CSV für Excel (Semikolon, UTF-8 mit BOM), alle Einnahmen und Ausgaben des Jahres. */
export function yearReportCsv(r: YearReport, label: (c: ExpenseCategory) => string): string {
  const amount = (n: number) => n.toFixed(2)
  const lines = [
    ['Typ', 'Datum', 'Beschreibung', 'Kategorie / Art', 'Kunde / Lieferant', 'Beleg / Rechnung', 'Betrag CHF', 'Originalwährung', 'Originalbetrag'],
    ...r.einnahmen.map(e => ['Einnahme', e.datum, `Rechnung ${e.rechnungsnummer}`, e.art, e.kunde, e.rechnungsnummer, amount(e.betrag), 'CHF', '']),
    ...r.ausgaben.map(e => [
      'Ausgabe', e.datum, e.beschreibung, label(e.kategorie), e.lieferant ?? '', e.beleg_name ?? '', amount(-Number(e.betrag)),
      e.waehrung ?? 'CHF', e.waehrung && e.waehrung !== 'CHF' && e.betrag_original !== null ? amount(-Number(e.betrag_original)) : '',
    ]),
    [],
    ['Total Einnahmen', '', '', '', '', '', amount(r.einnahmenTotal), '', ''],
    ['Total Ausgaben', '', '', '', '', '', amount(-r.ausgabenTotal), '', ''],
    ['Gewinn', '', '', '', '', '', amount(r.gewinn), '', ''],
  ]
  return '﻿' + lines.map(l => l.map(v => csvCell(v)).join(';')).join('\r\n') + '\r\n'
}
