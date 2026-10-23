import type { Invoice, TimeEntry } from '@/lib/types'

export type DashboardStats = {
  kundenAnzahl: number
  gesamtverdienst: number
  verdienstJahr: number
  offenBetrag: number
  offenAnzahl: number
  /** Alle versendeten und bezahlten Rechnungen (ohne Entwürfe und Stornierte) */
  rechnungenAnzahl: number
}

/** Anteil eines Kunden an einem Monatswert (für gestapelte Balken). */
export type MonthPart = { key: string; label: string; value: number }
export type MonthlyRevenue = { month: string; label: string; total: number; parts: MonthPart[] }

type WithCustomer = { customer_id: string; customer?: { firma_oder_name: string } | null }

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function sum(invoices: Invoice[]): number {
  return round2(invoices.reduce((s, i) => s + Number(i.betrag), 0))
}

/**
 * Verdienst = bezahlte Rechnungen, Jahr nach Rechnungsdatum. Entwürfe zählen nirgends mit.
 * `gedeckt`: bereits über das Kundenkonto gedeckter Teil offener Rechnungen (zählt nicht als offen).
 */
export function computeDashboardStats(
  invoices: Invoice[],
  kundenAnzahl: number,
  jahr: number,
  gedeckt: Map<string, number> = new Map(),
): DashboardStats {
  const bezahlt = invoices.filter(i => i.status === 'bezahlt')
  const offen = invoices.filter(i => i.status === 'versendet')
  return {
    kundenAnzahl,
    gesamtverdienst: sum(bezahlt),
    verdienstJahr: sum(bezahlt.filter(i => i.rechnungsdatum.startsWith(String(jahr)))),
    offenBetrag: round2(offen.reduce((s, i) => s + Number(i.betrag) - (gedeckt.get(i.id) ?? 0), 0)),
    offenAnzahl: offen.length,
    rechnungenAnzahl: invoices.filter(i => i.status === 'versendet' || i.status === 'bezahlt').length,
  }
}

export type CustomerShare = { customerId: string; kunde: string; betrag: number; anteil: number }

/** Bezahlte Rechnungen aller Jahre pro Kunde (wie der Gesamtverdienst), grösster Anteil zuerst. */
export function revenueByCustomer(invoices: (Pick<Invoice, 'customer_id' | 'status' | 'betrag'> & Partial<WithCustomer>)[]): CustomerShare[] {
  const rows = new Map<string, { kunde: string; betrag: number }>()
  for (const i of invoices) {
    if (i.status !== 'bezahlt') continue
    const r = rows.get(i.customer_id) ?? { kunde: i.customer?.firma_oder_name ?? 'Unbekannt', betrag: 0 }
    r.betrag += Number(i.betrag)
    rows.set(i.customer_id, r)
  }
  const total = Array.from(rows.values()).reduce((s, r) => s + r.betrag, 0)
  return Array.from(rows.entries())
    .map(([customerId, r]) => ({ customerId, kunde: r.kunde, betrag: round2(r.betrag), anteil: total > 0 ? r.betrag / total : 0 }))
    .filter(r => r.betrag > 0)
    .sort((a, b) => b.betrag - a.betrag)
}

/** Umsatzgrenze für die MWST-Pflicht (Art. 10 Abs. 2 lit. a MWSTG). */
export const MWST_SCHWELLE = 100_000

export type VatStatus = {
  jahr: number
  /** Verrechneter Umsatz im Jahr (versendet + bezahlt, nach Rechnungsdatum) */
  umsatz: number
  schwelle: number
  /** 0–1, Anteil an der Schwelle (gedeckelt auf 1) */
  anteil: number
  stufe: 'unter' | 'nahe' | 'pflichtig'
}

/**
 * MWST-Pflicht hängt am vereinbarten (verrechneten) Entgelt pro Jahr, darum
 * zählen hier auch versendete, noch nicht bezahlte Rechnungen. Entwürfe nicht.
 */
export function computeVatStatus(invoices: Invoice[], jahr: number): VatStatus {
  const umsatz = sum(invoices.filter(i =>
    (i.status === 'versendet' || i.status === 'bezahlt') && i.rechnungsdatum.startsWith(String(jahr))))
  const anteil = Math.min(1, umsatz / MWST_SCHWELLE)
  const stufe = umsatz >= MWST_SCHWELLE ? 'pflichtig' : anteil >= 0.8 ? 'nahe' : 'unter'
  return { jahr, umsatz, schwelle: MWST_SCHWELLE, anteil, stufe }
}

const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

/** Summen pro Monat für die letzten `monthsBack` Monate bis und mit dem Monat von `now`. */
function sumByMonth<T extends WithCustomer>(items: T[], date: (item: T) => string, value: (item: T) => number, monthsBack: number, now: Date): MonthlyRevenue[] {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (monthsBack - 1), 1))
  const months: MonthlyRevenue[] = []
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1))
    const year = d.getUTCFullYear()
    const monthIdx = d.getUTCMonth()
    const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`
    const inMonth = items.filter(it => date(it).startsWith(key))
    const byCustomer = new Map<string, MonthPart>()
    for (const it of inMonth) {
      const part = byCustomer.get(it.customer_id)
        ?? { key: it.customer_id, label: it.customer?.firma_oder_name ?? 'Unbekannt', value: 0 }
      part.value += value(it)
      byCustomer.set(it.customer_id, part)
    }
    const parts = Array.from(byCustomer.values())
      .map(p => ({ ...p, value: round2(p.value) }))
      .sort((a, b) => b.value - a.value)
    const total = round2(inMonth.reduce((s, it) => s + value(it), 0))
    months.push({ month: key, label: `${MONATE[monthIdx]} ${String(year).slice(2)}`, total, parts })
  }
  return months
}

/**
 * Bezahlte Rechnungsbeträge pro Monat, nach Rechnungsdatum (gleiche Logik wie
 * Verdienst), für die letzten `monthsBack` Monate bis und mit dem Monat von `now`.
 */
export function computeMonthlyRevenue(invoices: (Invoice & WithCustomer)[], monthsBack: number, now: Date): MonthlyRevenue[] {
  return sumByMonth(invoices.filter(i => i.status === 'bezahlt'), i => i.rechnungsdatum, i => Number(i.betrag), monthsBack, now)
}

type HoursEntry = Pick<TimeEntry, 'datum' | 'stunden' | 'billed' | 'customer_id'> & Pick<WithCustomer, 'customer'>

/** Gearbeitete Stunden pro Monat (verrechnet und offen), nach Datum des Eintrags. */
export function computeMonthlyHours(entries: HoursEntry[], monthsBack: number, now: Date): MonthlyRevenue[] {
  return sumByMonth(entries, e => e.datum, e => Number(e.stunden), monthsBack, now)
}

/** Stunden im Jahr, davon noch nicht verrechnet. */
export function computeYearHours(entries: Pick<TimeEntry, 'datum' | 'stunden' | 'billed'>[], jahr: number): { total: number; offen: number } {
  const imJahr = entries.filter(e => e.datum.startsWith(String(jahr)))
  return {
    total: round2(imJahr.reduce((s, e) => s + Number(e.stunden), 0)),
    offen: round2(imJahr.filter(e => !e.billed).reduce((s, e) => s + Number(e.stunden), 0)),
  }
}

/** Ab so vielen Tagen seit Versand gilt eine Rechnung als überfällig. */
export const ZAHLUNGSFRIST_TAGE = 30

export type OpenInvoiceRow = {
  id: string
  rechnungsnummer: string
  kunde: string
  /** Offener Betrag (bei Material-Verrechnung nur der ungedeckte Rest) */
  rest: number
  /** Tage seit Versand (ersatzweise seit Rechnungsdatum) */
  tage: number
  ueberfaellig: boolean
}

/** Versendete, noch offene Rechnungen, älteste zuerst. `gedeckt`: über das Kundenkonto gedeckter Teil. */
export function openInvoiceRows(
  invoices: (Invoice & WithCustomer)[],
  gedeckt: Map<string, number>,
  now: Date,
): OpenInvoiceRow[] {
  return invoices
    .filter(i => i.status === 'versendet')
    .map(i => {
      const seit = Date.parse(i.sent_at ?? `${i.rechnungsdatum}T00:00:00Z`)
      const tage = Math.max(0, Math.floor((now.getTime() - seit) / 86_400_000))
      return {
        id: i.id,
        rechnungsnummer: i.rechnungsnummer,
        kunde: i.customer?.firma_oder_name ?? 'Unbekannt',
        rest: round2(Number(i.betrag) - (gedeckt.get(i.id) ?? 0)),
        tage,
        ueberfaellig: tage > ZAHLUNGSFRIST_TAGE,
      }
    })
    .filter(r => r.rest > 0)
    .sort((a, b) => b.tage - a.tage)
}

export type UnbilledRow = { customerId: string; kunde: string; stunden: number; wert: number }

/** Noch nicht verrechnete Stunden pro Kunde (alle Jahre) mit Wert (Stunden × Satz), wertvollste zuerst. */
export function unbilledHoursByCustomer(
  entries: (Pick<TimeEntry, 'customer_id' | 'stunden' | 'stundensatz' | 'billed'> & Pick<WithCustomer, 'customer'>)[],
): UnbilledRow[] {
  const rows = new Map<string, UnbilledRow>()
  for (const e of entries) {
    if (e.billed) continue
    const row = rows.get(e.customer_id)
      ?? { customerId: e.customer_id, kunde: e.customer?.firma_oder_name ?? 'Unbekannt', stunden: 0, wert: 0 }
    row.stunden += Number(e.stunden)
    row.wert += Number(e.stunden) * Number(e.stundensatz)
    rows.set(e.customer_id, row)
  }
  return Array.from(rows.values())
    .map(r => ({ ...r, stunden: round2(r.stunden), wert: round2(r.wert) }))
    .sort((a, b) => b.wert - a.wert)
}

// Beträge nach den Schreibweisungen der Bundeskanzlei (Rz. 512–513, 539–546):
// «Fr.» vor dem Betrag, Dreiergruppen mit schmalem geschütztem Abstand (kein Apostroph),
// vierstellige Zahlen ungetrennt, Dezimalpunkt. Bewusste Abweichung von Rz. 541: immer zwei
// Nachkommastellen (Fr. 20.00 statt Fr. 20.–), damit Beträge in Listen sauber untereinander stehen.

/** Schmaler geschützter Abstand für Zifferngruppen (Festabstand, Rz. 251/512). */
export const ZIFFERN_ABSTAND = '\u202F'
/** Geschützter Abstand zwischen «Fr.» und Betrag (Rz. 540). */
const KUERZEL_ABSTAND = '\u00A0'

export type BetragOptionen = {
  /** Tabellen mit fünfstelligen Zahlen: auch vierstellige gliedern (Rz. 513) */
  tabelle?: boolean
  /** Abstand zwischen Zifferngruppen, z. B. U+00A0 für PDF-Standardschriften ohne U+202F */
  abstand?: string
}

/** Ganze Zahl in Dreiergruppen; vierstellige nur in Tabellen gegliedert (Rz. 512/513). */
export function formatZahl(n: number, opts: BetragOptionen = {}): string {
  const ziffern = String(Math.round(Math.abs(n)))
  const gruppiert = ziffern.length <= 4 && !opts.tabelle
    ? ziffern
    : ziffern.replace(/\B(?=(\d{3})+(?!\d))/g, opts.abstand ?? ZIFFERN_ABSTAND)
  return `${n < 0 && ziffern !== '0' ? '−' : ''}${gruppiert}`
}

/** Betrag ohne Währung, immer mit zwei Nachkommastellen: 1250.50, 12 500.00, 0.15 */
export function formatBetrag(n: number, opts: BetragOptionen = {}): string {
  const rappenTotal = Math.round(Math.abs(n) * 100)
  const franken = Math.floor(rappenTotal / 100)
  const rappen = String(rappenTotal % 100).padStart(2, '0')
  return `${n < 0 && rappenTotal > 0 ? '−' : ''}${formatZahl(franken, opts)}.${rappen}`
}

/** Betrag mit Währungskürzel: Fr. 1250.50 */
export function formatChf(n: number, opts: BetragOptionen = {}): string {
  return `Fr.${KUERZEL_ABSTAND}${formatBetrag(n, opts)}`
}

/** Fremdwährung mit ISO-Code vor dem Betrag (Rz. 545/547): EUR 120.00 */
export function formatWaehrung(n: number, code: string, opts: BetragOptionen = {}): string {
  return code === 'CHF' ? formatChf(n, opts) : `${code}${KUERZEL_ABSTAND}${formatBetrag(n, opts)}`
}

/** Stunden ohne überflüssige Nachkommastellen: 12, 7.5, 3.25 */
export function formatStunden(n: number): string {
  return String(round2(n))
}
