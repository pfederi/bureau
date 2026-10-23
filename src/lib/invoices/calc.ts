import type { InvoiceItem } from '@/lib/types'

const round2 = (n: number) => Math.round(n * 100) / 100

export function computeItemTotal(menge: number, einzelpreis: number): number {
  return round2(menge * einzelpreis)
}

export function computeInvoiceTotal(items: InvoiceItem[]): number {
  return round2(items.reduce((s, i) => s + i.gesamtpreis, 0))
}

/** Begrenzt einen Rabatt-Prozentsatz auf 0–100; ungültige Werte werden 0. */
export function normalizeDiscountPercent(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(n, 100)
}

/** Zwischensumme, Rabattbetrag und Endbetrag (auf Rappen gerundet). */
export function computeDiscountedTotals(zwischensumme: number, rabattProzent: number) {
  const rabatt = round2(zwischensumme * normalizeDiscountPercent(rabattProzent) / 100)
  return { zwischensumme: round2(zwischensumme), rabatt, total: round2(zwischensumme - rabatt) }
}
