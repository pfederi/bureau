import { describe, it, expect } from 'vitest'
import { parseTimeEntryForm } from '@/lib/db/timeEntries'

describe('parseTimeEntryForm', () => {
  it('parses hours and rate as numbers', () => {
    const fd = new FormData()
    fd.set('customer_id', '11111111-1111-1111-1111-111111111111')
    fd.set('datum', '2026-07-24')
    fd.set('beschreibung', 'Konzept')
    fd.set('stunden', '2.5')
    fd.set('stundensatz', '120')
    const p = parseTimeEntryForm(fd)
    expect(p.stunden).toBe(2.5)
    expect(p.stundensatz).toBe(120)
  })
})
