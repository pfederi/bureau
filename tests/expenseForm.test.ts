import { describe, it, expect } from 'vitest'
import { parseExpenseForm } from '@/lib/db/expenses'

const base = (extra: Record<string, string>) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries({ datum: '2026-10-20', beschreibung: 'Figma', kategorie: 'software', betrag: '11.26', ...extra })) fd.set(k, v)
  return fd
}

describe('parseExpenseForm', () => {
  it('defaults to francs without an original amount', () => {
    expect(parseExpenseForm(base({ betrag_original: '12' }))).toMatchObject({ waehrung: 'CHF', betrag: 11.26, betrag_original: null })
  })

  it('keeps the original amount for foreign currencies', () => {
    expect(parseExpenseForm(base({ waehrung: 'EUR', betrag_original: '12.00' }))).toMatchObject({ waehrung: 'EUR', betrag: 11.26, betrag_original: 12 })
  })

  it('requires the original amount for foreign currencies', () => {
    expect(() => parseExpenseForm(base({ waehrung: 'USD', betrag_original: '' }))).toThrow()
  })
})
