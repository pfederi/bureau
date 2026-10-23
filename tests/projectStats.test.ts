import { describe, it, expect } from 'vitest'
import { projectStats } from '@/lib/timeEntries/projectStats'

const e = (p: Record<string, unknown>) => ({ datum: '2025-02-10', stunden: 1, stundensatz: 200, billed: true, invoice_id: 'r1', projekt: 'Relaunch 2025', ...p }) as any

describe('projectStats', () => {
  it('sums hours and applies the invoice discount to the billed value', () => {
    const [r] = projectStats([e({ stunden: 2 }), e({ stunden: 1, datum: '2025-03-06' })], [{ id: 'r1', rabatt_prozent: 40, status: 'bezahlt' }] as any)
    expect(r).toMatchObject({ projekt: 'Relaunch 2025', stunden: 3, wert: 600, verrechnet: 360, effektiv: 120, von: '2025-02-10', bis: '2025-03-06' })
  })
  it('counts unbilled hours as open and ignores cancelled invoices', () => {
    const [r] = projectStats([e({ billed: false, invoice_id: null }), e({ invoice_id: 'r2' })], [{ id: 'r2', rabatt_prozent: 0, status: 'storniert' }] as any)
    expect(r).toMatchObject({ stunden: 2, offen: 200, verrechnet: 0, effektiv: null })
  })
  it('orders by latest work and puts entries without project last', () => {
    const rows = projectStats([
      e({ projekt: null, datum: '2026-10-01' }),
      e({ projekt: 'Relaunch 2023', datum: '2023-05-01' }),
      e({ projekt: 'Relaunch 2026', datum: '2026-04-20' }),
    ], [{ id: 'r1', rabatt_prozent: 0, status: 'bezahlt' }] as any)
    expect(rows.map(r => r.projekt)).toEqual(['Relaunch 2026', 'Relaunch 2023', null])
  })
})
