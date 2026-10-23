import { describe, it, expect } from 'vitest'
import { documentNumbers, findDuplicates } from '@/lib/expenses/duplicates'
import type { Expense } from '@/lib/types'

const exp = (p: Partial<Expense>): Expense => ({
  id: 'x', datum: '2026-10-15', beschreibung: 'Musterhost Cloud-Server, Rechnung 080000012345', lieferant: 'Musterhost GmbH',
  kategorie: 'hosting', betrag: 60.16, waehrung: 'EUR', betrag_original: 64.90, beleg_path: 'p', beleg_name: 'Musterhost_2026-10-15_080000012345.pdf', ...p,
})
const cand = (p: Record<string, unknown>) => ({ datum: '', betrag: 0, waehrung: 'CHF' as const, betrag_original: null, beschreibung: '', beleg_name: null, ...p })

describe('documentNumbers', () => {
  it('finds invoice numbers but ignores short numbers and plain words', () => {
    expect(documentNumbers('Musterhost Cloud-Server, Rechnung 080000012345')).toEqual(['080000012345'])
    expect(documentNumbers('Rechnung RE-2026-OCT-16-43-0002 an Kunde 43')).toEqual(['RE-2026-OCT-16-43-0002'])
    expect(documentNumbers('Adobe CC Oktober 2026, 3 Lizenzen')).toEqual([])
  })
})

describe('findDuplicates', () => {
  const existing = [exp({})]

  it('detects the same invoice number', () => {
    const m = findDuplicates(cand({ beschreibung: 'Rechnung 080000012345 Musterhost', datum: '2026-10-20', betrag: 10 }), existing)
    expect(m.map(x => x.grund)).toEqual(['gleiche Belegnummer 080000012345'])
  })

  it('detects the same receipt file', () => {
    expect(findDuplicates(cand({ beleg_name: 'Musterhost_2026-10-15_080000012345.pdf' }), existing)).toHaveLength(1)
  })

  it('detects same date and same original amount for foreign currencies', () => {
    const m = findDuplicates(cand({ datum: '2026-10-15', waehrung: 'EUR', betrag_original: 64.90, betrag: 60.5, beschreibung: 'Server' }), existing)
    expect(m[0].grund).toBe('gleiches Datum und gleicher Betrag')
  })

  it('ignores the expense itself and unrelated entries', () => {
    expect(findDuplicates({ ...exp({}), id: 'x' }, existing)).toEqual([])
    expect(findDuplicates(cand({ datum: '2026-10-15', betrag: 12, beschreibung: 'Kaffee' }), existing)).toEqual([])
  })
})
