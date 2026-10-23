import { describe, it, expect } from 'vitest'
import { toChf, rateUrl, parseRate } from '@/lib/expenses/currency'
import { formatWaehrung } from '@/lib/invoices/stats'

describe('currency', () => {
  it('converts to francs rounded to rappen', () => {
    expect(toChf(120, 0.9272)).toBe(111.26)
    expect(toChf(9.99, 0.82363)).toBe(8.23)
  })

  it('builds the ECB rate URL and parses the response', () => {
    expect(rateUrl('EUR', '2026-10-18')).toBe('https://api.frankfurter.dev/v1/2026-10-18?base=EUR&symbols=CHF')
    expect(parseRate({ amount: 1, base: 'EUR', date: '2026-10-16', rates: { CHF: 0.9272 } }))
      .toEqual({ kurs: 0.9272, datum: '2026-10-16', quelle: 'EZB-Referenzkurs' })
    expect(parseRate({ message: 'not found' })).toBeNull()
  })

  it('formats foreign amounts with the ISO code in front', () => {
    expect(formatWaehrung(120, 'EUR')).toBe('EUR 120.00')
    expect(formatWaehrung(12500, 'USD')).toBe('USD 12 500.00')
    expect(formatWaehrung(20, 'CHF')).toBe('Fr. 20.00')
  })
})
