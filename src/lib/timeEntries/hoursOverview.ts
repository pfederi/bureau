import type { Invoice, TimeEntry } from '@/lib/types'

type Entry = Pick<TimeEntry, 'id' | 'datum' | 'beschreibung' | 'stunden' | 'stundensatz' | 'billed' | 'invoice_id'>
type Inv = Pick<Invoice, 'id' | 'rechnungsnummer' | 'status'>

export type HoursRow = {
  id: string
  datum: string
  beschreibung: string
  stunden: number
  /** Stunden × Stundensatz, auf Rappen gerundet */
  betrag: number
  /** Rechnung des Eintrags, null bei offenen Einträgen oder ohne Verknüpfung */
  rechnung: Inv | null
}

export type HoursGroup = { rows: HoursRow[]; stunden: number; betrag: number }

const round2 = (n: number) => Math.round(n * 100) / 100

function group(rows: HoursRow[]): HoursGroup {
  return {
    rows,
    stunden: round2(rows.reduce((s, r) => s + r.stunden, 0)),
    betrag: round2(rows.reduce((s, r) => s + r.betrag, 0)),
  }
}

/**
 * Verrechnete und offene Stunden eines Kunden, neueste zuerst. Ein Eintrag auf einer
 * Rechnung, die nicht in `invoices` steht (auf der Kundenseite: Entwürfe), gilt als offen.
 */
export function hoursOverview(entries: Entry[], invoices: Inv[]): { offen: HoursGroup; verrechnet: HoursGroup } {
  const byId = new Map(invoices.map(i => [i.id, i]))
  const offen: HoursRow[] = []
  const verrechnet: HoursRow[] = []
  const sorted = [...entries].sort((a, b) => b.datum.localeCompare(a.datum))
  for (const e of sorted) {
    const rechnung = e.invoice_id ? byId.get(e.invoice_id) ?? null : null
    const row: HoursRow = {
      id: e.id,
      datum: e.datum,
      beschreibung: e.beschreibung,
      stunden: Number(e.stunden),
      betrag: round2(Number(e.stunden) * Number(e.stundensatz)),
      rechnung,
    }
    const istVerrechnet = e.billed && (e.invoice_id === null || rechnung !== null)
    ;(istVerrechnet ? verrechnet : offen).push(row)
  }
  return { offen: group(offen), verrechnet: group(verrechnet) }
}
