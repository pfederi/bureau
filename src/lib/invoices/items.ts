import { computeItemTotal } from '@/lib/invoices/calc'
import type { InvoiceItem } from '@/lib/types'

/** Positionen kommen als JSON-String aus dem Client-Formular (Feld `items`). */
export function parseItemsField(formData: FormData): InvoiceItem[] {
  const raw = JSON.parse(String(formData.get('items') || '[]')) as Array<
    Pick<InvoiceItem, 'bezeichnung' | 'menge' | 'einheit' | 'einzelpreis'>
  >
  return raw.map((r, idx) => ({
    position: idx + 1,
    bezeichnung: r.bezeichnung,
    menge: Number(r.menge),
    einheit: r.einheit,
    einzelpreis: Number(r.einzelpreis),
    gesamtpreis: computeItemTotal(Number(r.menge), Number(r.einzelpreis)),
  }))
}
