import { describe, it, expect } from 'vitest'
import { parseSettingsForm } from '@/lib/db/settings'

describe('parseSettingsForm', () => {
  it('coerces numeric fields', () => {
    const fd = new FormData()
    fd.set('absender_name', 'Anna Muster')
    fd.set('standard_stundensatz', '150')
    fd.set('naechste_nummer', '9')
    const parsed = parseSettingsForm(fd)
    expect(parsed.standard_stundensatz).toBe(150)
    expect(parsed.naechste_nummer).toBe(9)
    expect(parsed.absender_name).toBe('Anna Muster')
  })
})
