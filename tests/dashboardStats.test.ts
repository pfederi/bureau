import { describe, it, expect } from 'vitest'
import { computeDashboardStats, computeMonthlyRevenue, computeMonthlyHours, computeYearHours, computeVatStatus, formatChf, formatBetrag, formatZahl, formatStunden, openInvoiceRows, unbilledHoursByCustomer, revenueByCustomer } from '@/lib/invoices/stats'
import type { Invoice } from '@/lib/types'

function inv(p: Partial<Invoice>): Invoice {
  return {
    id: 'i', rechnungsnummer: 'RE-2026-JAN-01-1-0001', customer_id: 'c', typ: 'pauschal',
    status: 'entwurf', rechnungsdatum: '2026-01-01', leistungsdatum: null, betrag: 0, rabatt_prozent: 0, hosting_jahr: null, verrechnung_material: false,
    waehrung: 'CHF', notiz: null, mwst_hinweis: '', sent_at: null, paid_at: null, erinnert_am: null, storniert_am: null, offerte_id: null, ...p,
  }
}

describe('computeDashboardStats', () => {
  const invoices = [
    inv({ id: '1', status: 'bezahlt', betrag: 1000, rechnungsdatum: '2026-03-05' }),
    inv({ id: '2', status: 'bezahlt', betrag: 250.5, rechnungsdatum: '2025-11-20' }),
    inv({ id: '3', status: 'versendet', betrag: 400, rechnungsdatum: '2026-06-01' }),
    inv({ id: '4', status: 'entwurf', betrag: 9999, rechnungsdatum: '2026-07-01' }),
  ]

  it('counts customers', () => {
    expect(computeDashboardStats(invoices, 7, 2026).kundenAnzahl).toBe(7)
  })

  it('sums all paid invoices as Gesamtverdienst', () => {
    expect(computeDashboardStats(invoices, 7, 2026).gesamtverdienst).toBe(1250.5)
  })

  it('sums only paid invoices of the given year', () => {
    expect(computeDashboardStats(invoices, 7, 2026).verdienstJahr).toBe(1000)
    expect(computeDashboardStats(invoices, 7, 2025).verdienstJahr).toBe(250.5)
  })

  it('sums sent but unpaid invoices as offen, ignoring drafts', () => {
    const s = computeDashboardStats(invoices, 7, 2026)
    expect(s.offenBetrag).toBe(400)
    expect(s.offenAnzahl).toBe(1)
  })

  it('counts only the uncovered rest of invoices partly settled via the account', () => {
    const s = computeDashboardStats(invoices, 7, 2026, new Map([['3', 150]]))
    expect(s.offenBetrag).toBe(250)
  })

  it('rounds sums to 2 decimals', () => {
    const s = computeDashboardStats(
      [inv({ status: 'bezahlt', betrag: 0.1 }), inv({ status: 'bezahlt', betrag: 0.2 })], 0, 2026)
    expect(s.gesamtverdienst).toBe(0.3)
  })

  it('handles an empty list', () => {
    expect(computeDashboardStats([], 0, 2026)).toEqual({
      kundenAnzahl: 0, gesamtverdienst: 0, verdienstJahr: 0, offenBetrag: 0, offenAnzahl: 0, rechnungenAnzahl: 0,
    })
  })

  it('counts all sent and paid invoices, not drafts or cancelled ones', () => {
    const list = [...invoices, inv({ id: '5', status: 'storniert', rechnungsdatum: '2026-08-01' })]
    expect(computeDashboardStats(list, 7, 2026).rechnungenAnzahl).toBe(3)
  })
})

describe('computeMonthlyRevenue', () => {
  const invoices = [
    inv({ status: 'bezahlt', betrag: 1000, rechnungsdatum: '2026-03-05' }),
    inv({ status: 'bezahlt', betrag: 250.5, rechnungsdatum: '2026-03-20' }),
    inv({ status: 'bezahlt', betrag: 400, rechnungsdatum: '2026-01-10' }),
    inv({ status: 'versendet', betrag: 9999, rechnungsdatum: '2026-03-15' }),
    inv({ status: 'entwurf', betrag: 9999, rechnungsdatum: '2026-03-15' }),
    inv({ status: 'bezahlt', betrag: 50, rechnungsdatum: '2025-04-01' }),
  ]

  it('sums paid invoices per month, ignoring unpaid/drafts', () => {
    const months = computeMonthlyRevenue(invoices, 3, new Date('2026-03-15T00:00:00Z'))
    expect(months).toEqual([
      { month: '2026-01', label: 'Jan 26', total: 400, parts: [{ key: 'c', label: 'Unbekannt', value: 400 }] },
      { month: '2026-02', label: 'Feb 26', total: 0, parts: [] },
      { month: '2026-03', label: 'Mär 26', total: 1250.5, parts: [{ key: 'c', label: 'Unbekannt', value: 1250.5 }] },
    ])
  })

  it('returns months in chronological order ending at "now", excluding earlier years out of range', () => {
    const months = computeMonthlyRevenue(invoices, 2, new Date('2026-01-15T00:00:00Z'))
    expect(months.map(m => m.month)).toEqual(['2025-12', '2026-01'])
    expect(months.find(m => m.month === '2026-01')?.total).toBe(400)
  })

  it('handles an empty list', () => {
    const months = computeMonthlyRevenue([], 1, new Date('2026-06-01T00:00:00Z'))
    expect(months).toEqual([{ month: '2026-06', label: 'Jun 26', total: 0, parts: [] }])
  })
})

describe('formatChf (Schreibweisungen der Bundeskanzlei)', () => {
  const NB = '\u00A0' // geschützter Abstand nach «Fr.»
  const G = '\u202F' // schmaler Abstand zwischen Dreiergruppen

  it('puts «Fr.» before the amount with a protected space and a decimal point', () => {
    expect(formatChf(23.5)).toBe(`Fr.${NB}23.50`)
  })

  it('leaves four-digit amounts ungrouped and groups larger ones in threes, no apostrophe', () => {
    expect(formatChf(1250.5)).toBe(`Fr.${NB}1250.50`)
    expect(formatChf(12500.4)).toBe(`Fr.${NB}12${G}500.40`)
    expect(formatChf(1234567.89)).toBe(`Fr.${NB}1${G}234${G}567.89`)
  })

  it('groups four-digit amounts too in tables', () => {
    expect(formatBetrag(1250.5, { tabelle: true })).toBe(`1${G}250.50`)
  })

  it('always shows two decimals so amounts line up in lists', () => {
    expect(formatChf(20)).toBe(`Fr.${NB}20.00`)
    expect(formatChf(3564)).toBe(`Fr.${NB}3564.00`)
    expect(formatChf(0.15)).toBe(`Fr.${NB}0.15`)
    expect(formatChf(0)).toBe(`Fr.${NB}0.00`)
  })

  it('rounds to rappen and can use another group separator (PDF)', () => {
    expect(formatBetrag(99999.999, { abstand: ' ' })).toBe('100 000.00')
  })

  it('formats plain numbers in groups of three', () => {
    expect(formatZahl(1360)).toBe('1360')
    expect(formatZahl(12500)).toBe(`12${G}500`)
  })
})

describe('computeVatStatus', () => {
  it('counts sent and paid invoices of the year, not drafts or other years', () => {
    const vat = computeVatStatus([
      inv({ id: '1', status: 'bezahlt', betrag: 30000, rechnungsdatum: '2026-02-01' }),
      inv({ id: '2', status: 'versendet', betrag: 20000, rechnungsdatum: '2026-05-01' }),
      inv({ id: '3', status: 'entwurf', betrag: 90000, rechnungsdatum: '2026-06-01' }),
      inv({ id: '4', status: 'bezahlt', betrag: 90000, rechnungsdatum: '2025-06-01' }),
    ], 2026)
    expect(vat).toMatchObject({ umsatz: 50000, anteil: 0.5, stufe: 'unter', schwelle: 100000 })
  })
  it('warns from 80% and flags liability at the threshold', () => {
    expect(computeVatStatus([inv({ status: 'bezahlt', betrag: 80000, rechnungsdatum: '2026-01-01' })], 2026).stufe).toBe('nahe')
    const over = computeVatStatus([inv({ status: 'versendet', betrag: 120000, rechnungsdatum: '2026-01-01' })], 2026)
    expect(over).toMatchObject({ stufe: 'pflichtig', anteil: 1 })
  })
})

describe('computeMonthlyHours', () => {
  const ww = { firma_oder_name: 'Muster AG' }
  const ac = { firma_oder_name: 'Acme' }
  const entries = [
    { datum: '2026-09-03', stunden: 2.5, billed: true, customer_id: 'ww', customer: ww },
    { datum: '2026-09-20', stunden: 1.25, billed: false, customer_id: 'ac', customer: ac },
    { datum: '2026-09-25', stunden: 1, billed: false, customer_id: 'ww', customer: ww },
    { datum: '2026-10-01', stunden: 4, billed: false, customer_id: 'ww', customer: ww },
    { datum: '2025-08-31', stunden: 9, billed: true, customer_id: 'ww', customer: ww },
  ]

  it('sums hours per month for the last N months, billed and open', () => {
    const m = computeMonthlyHours(entries, 3, new Date(Date.UTC(2026, 9, 21)))
    expect(m.map(x => [x.month, x.total])).toEqual([['2026-08', 0], ['2026-09', 4.75], ['2026-10', 4]])
    expect(m[2].label).toBe('Okt 26')
  })

  it('splits each month by customer, largest first', () => {
    const m = computeMonthlyHours(entries, 3, new Date(Date.UTC(2026, 9, 21)))
    expect(m[1].parts).toEqual([
      { key: 'ww', label: 'Muster AG', value: 3.5 },
      { key: 'ac', label: 'Acme', value: 1.25 },
    ])
    expect(m[0].parts).toEqual([])
  })

  it('computes the year total and the open part', () => {
    expect(computeYearHours(entries, 2026)).toEqual({ total: 8.75, offen: 6.25 })
  })

  it('formats hours without trailing zeros', () => {
    expect(formatStunden(12)).toBe('12')
    expect(formatStunden(7.5)).toBe('7.5')
    expect(formatStunden(3.25)).toBe('3.25')
  })
})

describe('openInvoiceRows', () => {
  const now = new Date('2026-10-21T12:00:00Z')
  const rows = openInvoiceRows([
    { ...inv({ id: 'a', status: 'versendet', betrag: 1800, sent_at: '2026-10-09T08:00:00Z' }), customer: { firma_oder_name: 'Muster AG' } },
    { ...inv({ id: 'b', status: 'versendet', betrag: 1429, sent_at: '2026-09-10T08:00:00Z' }), customer: { firma_oder_name: 'Acme' } },
    { ...inv({ id: 'c', status: 'versendet', betrag: 500, sent_at: null, rechnungsdatum: '2026-10-18' }), customer: { firma_oder_name: 'Müller' } },
    { ...inv({ id: 'd', status: 'versendet', betrag: 300, sent_at: '2026-10-01T08:00:00Z' }), customer: { firma_oder_name: 'Muster AG' } },
    { ...inv({ id: 'e', status: 'bezahlt', betrag: 999 }), customer: { firma_oder_name: 'X' } },
  ], new Map([['a', 300], ['d', 300]]), now)

  it('lists open invoices oldest first with the uncovered rest', () => {
    expect(rows.map(r => [r.id, r.rest, r.tage])).toEqual([['b', 1429, 41], ['a', 1500, 12], ['c', 500, 3]])
  })

  it('flags invoices open longer than 30 days', () => {
    expect(rows.map(r => r.ueberfaellig)).toEqual([true, false, false])
  })
})

describe('unbilledHoursByCustomer', () => {
  it('sums open hours and their value per customer, most valuable first', () => {
    const rows = unbilledHoursByCustomer([
      { customer_id: 'ac', stunden: 4, stundensatz: 180, billed: false, customer: { firma_oder_name: 'Acme' } },
      { customer_id: 'ww', stunden: 10, stundensatz: 180, billed: false, customer: { firma_oder_name: 'Muster AG' } },
      { customer_id: 'ww', stunden: 2.5, stundensatz: 120, billed: false, customer: { firma_oder_name: 'Muster AG' } },
      { customer_id: 'ww', stunden: 99, stundensatz: 180, billed: true, customer: { firma_oder_name: 'Muster AG' } },
    ])
    expect(rows).toEqual([
      { customerId: 'ww', kunde: 'Muster AG', stunden: 12.5, wert: 2100 },
      { customerId: 'ac', kunde: 'Acme', stunden: 4, wert: 720 },
    ])
  })
})

describe('revenueByCustomer', () => {
  it('sums paid invoices per customer with shares, largest first', () => {
    const r = revenueByCustomer([
      { customer_id: 'a', status: 'bezahlt', betrag: 300, customer: { firma_oder_name: 'A' } },
      { customer_id: 'b', status: 'bezahlt', betrag: 900, customer: { firma_oder_name: 'B' } },
      { customer_id: 'a', status: 'bezahlt', betrag: 0.1, customer: { firma_oder_name: 'A' } },
      { customer_id: 'b', status: 'versendet', betrag: 5000, customer: { firma_oder_name: 'B' } },
      { customer_id: 'c', status: 'storniert', betrag: 700, customer: { firma_oder_name: 'C' } },
    ] as any)
    expect(r.map(x => [x.customerId, x.betrag])).toEqual([['b', 900], ['a', 300.1]])
    expect(r[0].anteil + r[1].anteil).toBeCloseTo(1)
  })
  it('is empty without paid invoices', () => {
    expect(revenueByCustomer([])).toEqual([])
  })
})
