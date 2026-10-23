import type { Invoice, TimeEntry } from '@/lib/types'

export type ProjectStat = {
  projekt: string | null
  stunden: number
  /** Stunden × Stundensatz */
  wert: number
  /** Verrechneter Betrag nach Rabatt der Rechnung (stornierte Rechnungen zählen nicht) */
  verrechnet: number
  verrechneteStunden: number
  /** Noch nicht verrechnet (Stunden × Satz) */
  offen: number
  /** Verrechnet pro verrechnete Stunde, null ohne verrechnete Stunden */
  effektiv: number | null
  von: string
  bis: string
}

type Entry = Pick<TimeEntry, 'datum' | 'stunden' | 'stundensatz' | 'billed' | 'invoice_id'> & { projekt?: string | null }
type Inv = Pick<Invoice, 'id' | 'rabatt_prozent' | 'status'>

const round2 = (n: number) => Math.round(n * 100) / 100

/** Stunden und Ertrag pro Projekt, neuestes Projekt zuerst; Einträge ohne Projekt am Schluss. */
export function projectStats(entries: Entry[], invoices: Inv[]): ProjectStat[] {
  const byId = new Map(invoices.map(i => [i.id, i]))
  const rows = new Map<string, ProjectStat>()
  for (const e of entries) {
    const key = e.projekt ?? ''
    const r = rows.get(key) ?? {
      projekt: e.projekt ?? null, stunden: 0, wert: 0, verrechnet: 0, verrechneteStunden: 0, offen: 0, effektiv: null, von: e.datum, bis: e.datum,
    }
    const stunden = Number(e.stunden)
    const wert = stunden * Number(e.stundensatz)
    r.stunden += stunden
    r.wert += wert
    const inv = e.invoice_id ? byId.get(e.invoice_id) : undefined
    if (e.billed && inv && inv.status !== 'storniert') {
      r.verrechnet += wert * (1 - Number(inv.rabatt_prozent ?? 0) / 100)
      r.verrechneteStunden += stunden
    } else if (!e.billed) {
      r.offen += wert
    }
    if (e.datum < r.von) r.von = e.datum
    if (e.datum > r.bis) r.bis = e.datum
    rows.set(key, r)
  }
  return Array.from(rows.values())
    .map(r => ({
      ...r,
      stunden: round2(r.stunden), wert: round2(r.wert), verrechnet: round2(r.verrechnet),
      verrechneteStunden: round2(r.verrechneteStunden), offen: round2(r.offen),
      effektiv: r.verrechneteStunden > 0 ? round2(r.verrechnet / r.verrechneteStunden) : null,
    }))
    .sort((a, b) => Number(a.projekt === null) - Number(b.projekt === null) || b.bis.localeCompare(a.bis))
}
