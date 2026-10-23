import { describe, it, expect } from 'vitest'
import { hasHosting, hostingItemForYear, hostingYears, FIRST_HOSTING_YEAR } from '@/lib/invoices/hosting'

const base = { hosting_text: 'Webhosting & Wartung', hosting_preis_monat: 25, hosting_ab: null, hosting_bis: null }

describe('hostingItemForYear', () => {
  it('bills 12 months without a period', () => {
    expect(hostingItemForYear(base, 2026)).toEqual({
      bezeichnung: 'Webhosting & Wartung 2026', menge: 12, einheit: 'Monat', einzelpreis: 25,
    })
  })
  it('prorates from the start month', () => {
    const item = hostingItemForYear({ ...base, hosting_ab: '2026-04-01' }, 2026)
    expect(item).toMatchObject({ bezeichnung: 'Webhosting & Wartung 2026 (Apr–Dez)', menge: 9 })
  })
  it('prorates until the end month', () => {
    const item = hostingItemForYear({ ...base, hosting_ab: '2025-03-01', hosting_bis: '2026-06-01' }, 2026)
    expect(item).toMatchObject({ bezeichnung: 'Webhosting & Wartung 2026 (Jan–Jun)', menge: 6 })
  })
  it('handles a single month', () => {
    const item = hostingItemForYear({ ...base, hosting_ab: '2026-12-01' }, 2026)
    expect(item).toMatchObject({ bezeichnung: 'Webhosting & Wartung 2026 (Dez)', menge: 1 })
  })
  it('returns null outside the active period', () => {
    expect(hostingItemForYear({ ...base, hosting_ab: '2027-01-01' }, 2026)).toBeNull()
    expect(hostingItemForYear({ ...base, hosting_bis: '2025-12-01' }, 2026)).toBeNull()
  })
  it('returns null without a monthly price and falls back to «Hosting» as text', () => {
    expect(hasHosting({ ...base, hosting_preis_monat: null })).toBe(false)
    expect(hostingItemForYear({ ...base, hosting_preis_monat: 0 }, 2026)).toBeNull()
    expect(hostingItemForYear({ ...base, hosting_text: ' ' }, 2026)?.bezeichnung).toBe('Hosting 2026')
  })
})

describe('hosting before 2026', () => {
  it('has no hosting position before the first billed year', () => {
    expect(FIRST_HOSTING_YEAR).toBe(2026)
    expect(hostingItemForYear({ ...base, hosting_ab: '2021-01-01' }, 2025)).toBeNull()
    expect(hostingItemForYear({ ...base, hosting_ab: '2021-01-01' }, 2026)?.menge).toBe(12)
  })
  it('offers years from next year down to 2026', () => {
    expect(hostingYears(new Date('2026-10-21'))).toEqual(['2027', '2026'])
    expect(hostingYears(new Date('2028-03-01'))).toEqual(['2029', '2028', '2027', '2026'])
  })
})
