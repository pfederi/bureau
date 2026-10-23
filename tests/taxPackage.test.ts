import { edition } from '@/edition'
import { describe, it, expect } from 'vitest'
import { receiptFileName, taxPackageFileName, taxPackageReadme } from '@/lib/export/taxPackage'
import { computeYearReport } from '@/lib/expenses/report'

describe('receiptFileName', () => {
  it('names receipts by date, supplier, description and amount', () => {
    const n = new Set<string>()
    expect(receiptFileName({ datum: '2025-03-04', lieferant: 'cyon AG', beschreibung: 'Domain x.ch, Rechnung 3207958', betrag: 24.9, beleg_path: 'a/b.PDF' }, n))
      .toBe('2025-03-04 cyon AG - Domain x.ch - Fr. 24.90.pdf')
  })
  it('makes duplicate names unique and keeps the extension', () => {
    const n = new Set<string>()
    const e = { datum: '2025-03-04', lieferant: null, beschreibung: 'Kabel', betrag: 12500, beleg_path: 'x.jpg' }
    expect(receiptFileName(e, n)).toBe('2025-03-04 Kabel - Fr. 12 500.00.jpg')
    expect(receiptFileName(e, n)).toBe('2025-03-04 Kabel - Fr. 12 500.00 2.jpg')
  })
})

describe('taxPackageReadme', () => {
  it('summarises totals and lists expenses without receipt', () => {
    const report = computeYearReport(
      [{ id: 'i', rechnungsnummer: 'RE-1', rechnungsdatum: '2025-01-10', betrag: 1000, status: 'bezahlt', paid_at: '2025-02-01', verrechnung_material: false }],
      [{ id: 'e', datum: '2025-05-01', beschreibung: 'Hosting', lieferant: null, kategorie: 'hosting', betrag: 200, waehrung: 'CHF', betrag_original: null, beleg_path: null, beleg_name: null }],
      2025,
    )
    const t = taxPackageReadme({ report, now: new Date('2026-01-15T10:00:00Z'), belege: 0, ohneBeleg: [{ datum: '2025-05-01', beschreibung: 'Hosting', betrag: 200 }], rechnungen: 1, material: 0, fehler: [] })
    expect(t).toContain('Steuerunterlagen 2025')
    expect(t).toContain('Gewinn     Fr. 800.00')
    expect(t).toContain('- 01.05.2025  Hosting  Fr. 200.00')
    expect(t).not.toContain('material/')
    expect(taxPackageFileName(2025)).toBe(`${edition.slug}-steuerunterlagen-2025.zip`)
  })
})

describe('taxPackageReadme je Edition', () => {
  const report = computeYearReport([], [], 2025)
  const i = { report, now: new Date('2026-01-15T10:00:00Z'), belege: 0, ohneBeleg: [], rechnungen: 1, material: 2, fehler: [] }
  it('nennt Material nur mit Material-Edition', () => {
    const mit = taxPackageReadme(i, { ...edition, material: true })
    expect(taxPackageReadme(i, { ...edition, name: 'Name-A' })).toContain('Name-A – Steuerunterlagen 2025')
    expect(mit).toContain('mit Material verrechnet')
    expect(mit).toContain('material/     2 Belege')
    const ohne = taxPackageReadme(i, { ...edition, material: false })
    expect(ohne).toContain('2025 bezahlt wurden')
    expect(ohne).not.toMatch(/aterial/)
  })
})

describe('csvCell', async () => {
  const { csvCell } = await import('@/lib/export/csv')
  it('neutralises formulas but keeps negative amounts', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+41 44')).toBe("'+41 44")
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(csvCell('-cmd')).toBe("'-cmd")
    expect(csvCell('-200.00')).toBe('-200.00')
    expect(csvCell('-12')).toBe('-12')
    expect(csvCell("-2+3+cmd|' /C calc'!A0")).toBe(`'-2+3+cmd|' /C calc'!A0`)
    expect(csvCell('-1+HYPERLINK("x")')).toBe(`"'-1+HYPERLINK(""x"")"`)
    expect(csvCell('Kabel; rot')).toBe('"Kabel; rot"')
    expect(csvCell(null)).toBe('')
  })
})
