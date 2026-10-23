import { describe, it, expect } from 'vitest'
import { sanitizeSearch, searchTables } from '@/lib/db/search'
import { edition } from '@/edition'

describe('searchTables', () => {
  it('durchsucht projects nur mit Website', () => {
    expect(searchTables().includes('projects')).toBe(edition.website)
    expect(searchTables().slice(0, 4)).toEqual(['customers', 'invoices', 'quotes', 'time_entries'])
  })
  it('richtet sich nach der übergebenen Edition', () => {
    expect(searchTables({ ...edition, website: false, material: false })).toEqual(['customers', 'invoices', 'quotes', 'time_entries'])
    expect(searchTables({ ...edition, website: true, material: true })).toEqual(['customers', 'invoices', 'quotes', 'time_entries', 'projects'])
  })
})

describe('sanitizeSearch', () => {
  it('removes characters with a meaning in PostgREST filters', () => {
    expect(sanitizeSearch('  muster,ag (AG)*%  ')).toBe('muster ag AG')
  })

  it('keeps umlauts, digits and dashes', () => {
    expect(sanitizeSearch('Müller RE-2026-OCT')).toBe('Müller RE-2026-OCT')
  })
})
