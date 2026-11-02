import { describe, it, expect } from 'vitest'
import { hoursOverview } from '@/lib/timeEntries/hoursOverview'

const e = (p: Record<string, unknown>) => ({
  id: 'e1', datum: '2026-09-02', beschreibung: 'Workshop', stunden: 2, stundensatz: 40, billed: false, invoice_id: null, ...p,
}) as any
const r = (p: Record<string, unknown>) => ({ id: 'r1', rechnungsnummer: 'RE-2026-SEP-22-42-0004', status: 'bezahlt', ...p }) as any

describe('hoursOverview', () => {
  it('splits entries into open and billed with hours and amount', () => {
    const o = hoursOverview([
      e({ id: 'a' }),
      e({ id: 'b', billed: true, invoice_id: 'r1', stunden: 1.5, stundensatz: 120 }),
    ], [r({})])
    expect(o.offen).toMatchObject({ stunden: 2, betrag: 80 })
    expect(o.offen.rows.map(x => x.id)).toEqual(['a'])
    expect(o.verrechnet).toMatchObject({ stunden: 1.5, betrag: 180 })
    expect(o.verrechnet.rows[0]).toMatchObject({ id: 'b', betrag: 180, rechnung: { rechnungsnummer: 'RE-2026-SEP-22-42-0004' } })
  })

  it('treats entries on an invoice that is not in the list (e.g. a draft hidden from the customer) as open', () => {
    const o = hoursOverview([e({ billed: true, invoice_id: 'entwurf' })], [r({})])
    expect(o.offen.rows).toHaveLength(1)
    expect(o.offen.rows[0].rechnung).toBeNull()
    expect(o.verrechnet.rows).toHaveLength(0)
  })

  it('keeps billed entries without invoice link as billed, without invoice number', () => {
    const o = hoursOverview([e({ billed: true, invoice_id: null })], [])
    expect(o.verrechnet.rows[0]).toMatchObject({ rechnung: null })
  })

  it('sorts newest first and rounds sums to cents', () => {
    const o = hoursOverview([
      e({ id: 'alt', datum: '2026-07-22', stunden: 0.1, stundensatz: 33.33 }),
      e({ id: 'neu', datum: '2026-10-07', stunden: 0.2, stundensatz: 33.33 }),
    ], [])
    expect(o.offen.rows.map(x => x.id)).toEqual(['neu', 'alt'])
    expect(o.offen.stunden).toBe(0.3)
    expect(o.offen.betrag).toBe(10)
  })
})
