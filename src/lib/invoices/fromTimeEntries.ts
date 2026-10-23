import type { InvoiceItem, TimeEntry } from '@/lib/types'
import { computeItemTotal } from './calc'

export function itemsFromTimeEntries(entries: TimeEntry[]): InvoiceItem[] {
  return entries.map((e, idx) => ({
    position: idx + 1,
    bezeichnung: `${e.datum}: ${e.beschreibung}`,
    menge: e.stunden,
    einheit: 'Std.',
    einzelpreis: e.stundensatz,
    gesamtpreis: computeItemTotal(e.stunden, e.stundensatz),
  }))
}
