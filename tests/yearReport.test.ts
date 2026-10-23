import { describe, it, expect } from 'vitest'
import { computeYearReport, yearReportCsv, ahvGrenze } from '@/lib/expenses/report'
import { categoryLabel } from '@/lib/expenses/categories'
import type { Expense } from '@/lib/types'

const inv = (p: Record<string, unknown>) => ({
  id: 'i', rechnungsnummer: 'RE-1', rechnungsdatum: '2026-03-01', betrag: 100, status: 'bezahlt',
  paid_at: '2026-03-10T08:00:00+00:00', verrechnung_material: false, customer: { firma_oder_name: 'Muster AG' }, ...p,
}) as any
const exp = (p: Partial<Expense>): Expense => ({
  id: 'e', datum: '2026-02-01', beschreibung: 'Adobe', lieferant: 'Adobe', kategorie: 'software', betrag: 30, waehrung: 'CHF', betrag_original: null, beleg_path: null, beleg_name: null, ...p,
})

describe('computeYearReport', () => {
  const invoices = [
    inv({ id: 'a', betrag: 1000 }),
    inv({ id: 'b', rechnungsnummer: 'RE-2', betrag: 500, verrechnung_material: true, paid_at: '2026-06-01T00:00:00+00:00' }),
    inv({ id: 'c', rechnungsnummer: 'RE-3', rechnungsdatum: '2026-12-20', betrag: 800, paid_at: '2027-01-15T00:00:00+00:00' }),
    inv({ id: 'd', rechnungsnummer: 'RE-4', status: 'versendet', paid_at: null, betrag: 300 }),
    inv({ id: 'e', rechnungsnummer: 'RE-5', status: 'storniert', betrag: 999 }),
    inv({ id: 'f', rechnungsnummer: 'RE-6', paid_at: '2025-12-30T00:00:00+00:00', rechnungsdatum: '2025-12-01', betrag: 200 }),
  ]
  const expenses = [
    exp({ id: '1', betrag: 30 }),
    exp({ id: '2', kategorie: 'hosting', betrag: 12.5, datum: '2026-05-01' }),
    exp({ id: '3', kategorie: 'software', betrag: 20, datum: '2026-07-01' }),
    exp({ id: '4', betrag: 99, datum: '2025-07-01' }),
  ]
  const r = computeYearReport(invoices, expenses, 2026)

  it('counts income by payment date, including material settlements, never cancelled invoices', () => {
    expect(r.einnahmen.map(e => [e.rechnungsnummer, e.art])).toEqual([['RE-1', 'Zahlung'], ['RE-2', 'Material']])
    expect(r.einnahmenTotal).toBe(1500)
  })

  it('lists invoices still open at year end, also those paid only next year', () => {
    expect(r.offenAmJahresende.map(o => o.rechnungsnummer)).toEqual(['RE-4', 'RE-3'])
  })

  it('sums expenses per category in the fixed order and computes the profit', () => {
    expect(r.proKategorie).toEqual([
      { kategorie: 'software', label: 'Software und Abos', betrag: 50, anzahl: 2 },
      { kategorie: 'hosting', label: 'Hosting und Domains', betrag: 12.5, anzahl: 1 },
    ])
    expect(r.ausgabenTotal).toBe(62.5)
    expect(r.gewinn).toBe(1437.5)
  })

  it('exports a semicolon CSV with BOM, quoting where needed', () => {
    const csv = yearReportCsv(computeYearReport(invoices, [exp({ beschreibung: 'Kurs; Teil 1' })], 2026), categoryLabel)
    expect(csv.startsWith('﻿Typ;Datum;')).toBe(true)
    expect(csv).toContain('Ausgabe;2026-02-01;"Kurs; Teil 1";Software und Abos;Adobe;;-30.00;CHF;')
    expect(csv).toContain('Gewinn;;;;;;1470.00;;')
  })

  it('exports the original amount for foreign-currency expenses', () => {
    const csv = yearReportCsv(computeYearReport([], [exp({ waehrung: 'EUR', betrag: 111.26, betrag_original: 120 })], 2026), categoryLabel)
    expect(csv).toContain(';-111.26;EUR;-120.00')
  })
})

describe('ahvGrenze', () => {
  it('uses Fr. 2500 from 2026, Fr. 2300 before', () => {
    expect(ahvGrenze(2026)).toBe(2500)
    expect(ahvGrenze(2025)).toBe(2300)
  })
})

import { renderYearReportPdf } from '@/lib/pdf/yearReportPdf'

describe('renderYearReportPdf', () => {
  it('renders a PDF, also over several pages', async () => {
    const many = Array.from({ length: 80 }, (_, i) => exp({ id: String(i), beschreibung: `Position ${i}`, betrag: 10 + i }))
    const r = computeYearReport([inv({ betrag: 12500.4 })], many, 2026)
    const settings = { absender_name: 'Anna Muster', absender_adresse: 'Musterweg 1', absender_plz_ort: '8000 Zürich' } as any
    const buf = await renderYearReportPdf(r, computeYearReport([], [], 2025), settings)
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    expect((buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBeGreaterThan(1)
  })
})
