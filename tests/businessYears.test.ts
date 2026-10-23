import { describe, it, expect } from 'vitest'
import { listBusinessYears } from '@/lib/utils'

const oct2026 = new Date('2026-10-21T12:00:00')

describe('listBusinessYears', () => {
  it('starts at 2021 (oldest invoices), newest first', () => {
    expect(listBusinessYears(undefined, oct2026)).toEqual(['2026', '2025', '2024', '2023', '2022', '2021'])
  })
  it('accepts a later first year', () => {
    expect(listBusinessYears(2026, oct2026)).toEqual(['2026'])
  })
  it('grows with the current year', () => {
    expect(listBusinessYears(undefined, new Date('2027-01-02T12:00:00'))).toEqual(['2027', '2026', '2025', '2024', '2023', '2022', '2021'])
  })
})
