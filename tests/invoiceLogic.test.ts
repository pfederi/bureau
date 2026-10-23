import { describe, it, expect } from 'vitest'
import { computeItemTotal, computeInvoiceTotal, computeDiscountedTotals, normalizeDiscountPercent } from '@/lib/invoices/calc'
import { formatInvoiceNumber, formatQuoteNumber } from '@/lib/invoices/number'
import { itemsFromTimeEntries } from '@/lib/invoices/fromTimeEntries'
import { nextStatus } from '@/lib/invoices/status'
import type { TimeEntry } from '@/lib/types'

describe('calc', () => {
  it('rounds item total to 2 decimals', () => {
    expect(computeItemTotal(3, 21.055)).toBe(63.17)
    expect(computeItemTotal(1, 63.16)).toBe(63.16)
  })
  it('sums invoice items', () => {
    expect(computeInvoiceTotal([
      { position: 1, bezeichnung: 'A', menge: 1, einheit: 'Stück', einzelpreis: 63.16, gesamtpreis: 63.16 },
      { position: 2, bezeichnung: 'B', menge: 2, einheit: 'Std.', einzelpreis: 100, gesamtpreis: 200 },
    ])).toBe(263.16)
  })
  it('applies a percentage discount rounded to Rappen', () => {
    expect(computeDiscountedTotals(1200, 10)).toEqual({ zwischensumme: 1200, rabatt: 120, total: 1080 })
    expect(computeDiscountedTotals(263.16, 7.5)).toEqual({ zwischensumme: 263.16, rabatt: 19.74, total: 243.42 })
    expect(computeDiscountedTotals(500, 0)).toEqual({ zwischensumme: 500, rabatt: 0, total: 500 })
  })
  it('clamps discount percent to 0–100', () => {
    expect(normalizeDiscountPercent('15')).toBe(15)
    expect(normalizeDiscountPercent(-5)).toBe(0)
    expect(normalizeDiscountPercent(150)).toBe(100)
    expect(normalizeDiscountPercent(null)).toBe(0)
    expect(normalizeDiscountPercent('abc')).toBe(0)
  })
})

describe('formatInvoiceNumber', () => {
  it('formats RE-YYYY-MON-DD-{kundennummer}-####', () => {
    expect(formatInvoiceNumber(new Date('2026-07-24T00:00:00Z'), 42, 1)).toBe('RE-2026-JUL-24-42-0001')
    expect(formatInvoiceNumber(new Date('2025-01-15T00:00:00Z'), 7, 12)).toBe('RE-2025-JAN-15-7-0012')
  })
})

describe('itemsFromTimeEntries', () => {
  it('creates one line per entry with rounded totals', () => {
    const entries: TimeEntry[] = [
      { id: '1', customer_id: 'c', datum: '2026-07-01', beschreibung: 'Design', stunden: 2.5, stundensatz: 120, billed: false, invoice_id: null },
      { id: '2', customer_id: 'c', datum: '2026-07-02', beschreibung: 'Dev', stunden: 1, stundensatz: 120, billed: false, invoice_id: null },
    ]
    const items = itemsFromTimeEntries(entries)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ position: 1, menge: 2.5, einheit: 'Std.', einzelpreis: 120, gesamtpreis: 300 })
    expect(items[1].bezeichnung).toContain('Dev')
  })
})

describe('nextStatus', () => {
  it('handles transitions', () => {
    expect(nextStatus('entwurf', 'send')).toBe('versendet')
    expect(nextStatus('versendet', 'markPaid')).toBe('bezahlt')
    expect(nextStatus('bezahlt', 'markUnpaid')).toBe('versendet')
  })
})

describe('formatQuoteNumber', () => {
  it('uses the OF prefix with the same structure as invoices', () => {
    expect(formatQuoteNumber(new Date('2026-10-21T00:00:00Z'), 43, 2)).toBe('OF-2026-OCT-21-43-0002')
  })
})
