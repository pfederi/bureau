import { describe, it, expect } from 'vitest'
import { buildInvoicePayload } from '@/lib/db/invoices'

describe('buildInvoicePayload', () => {
  it('assembles invoice row with computed total and mwst note', () => {
    const { invoice, items } = buildInvoicePayload({
      rechnungsnummer: 'RE-2025-JAN-15-0007',
      customer_id: 'c1',
      typ: 'pauschal',
      rechnungsdatum: '2025-01-15',
      leistungsdatum: '2024',
      notiz: null,
      mwst_hinweis: 'Von der MWST gemäss Art. 10 Abs. 2 befreit.',
      rabatt_prozent: 0,
      items: [
        { position: 1, bezeichnung: 'Provision 2024', menge: 1, einheit: 'Stück', einzelpreis: 63.16, gesamtpreis: 63.16 },
      ],
    })
    expect(invoice.betrag).toBe(63.16)
    expect(invoice.status).toBe('entwurf')
    expect(invoice.waehrung).toBe('CHF')
    expect(items).toHaveLength(1)
  })

  it('stores the discounted total as betrag', () => {
    const { invoice } = buildInvoicePayload({
      rechnungsnummer: 'RE-2026-OKT-16-42-0001',
      customer_id: 'c1',
      typ: 'stunden',
      rechnungsdatum: '2026-10-16',
      leistungsdatum: '2026',
      notiz: null,
      mwst_hinweis: '',
      rabatt_prozent: 10,
      items: [
        { position: 1, bezeichnung: 'Dev', menge: 10, einheit: 'Std.', einzelpreis: 120, gesamtpreis: 1200 },
      ],
    })
    expect(invoice.betrag).toBe(1080)
    expect(invoice.rabatt_prozent).toBe(10)
  })
})
