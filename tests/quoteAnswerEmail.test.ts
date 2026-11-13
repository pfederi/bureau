import { describe, it, expect } from 'vitest'
import { buildQuoteAnswerEmail } from '@/lib/email/quoteAnswer'

const basis = { kunde: 'Muster AG', customerId: 'k1', offertnummer: 'OF-2026-NOV-02-2-0001', betrag: 4200, name: 'Max Muster', grund: null }

describe('buildQuoteAnswerEmail', () => {
  it('Annahme: Betreff, Betrag und Link', () => {
    const m = buildQuoteAnswerEmail({ ...basis, antwort: 'annehmen' }, 'https://admin.example.ch')
    expect(m.subject).toBe('Muster AG hat Offerte OF-2026-NOV-02-2-0001 angenommen')
    expect(m.text).toContain('Max Muster')
    expect(m.text).toContain('https://admin.example.ch/admin/offerten?kunde=k1&jahr=alle')
    expect(m.html).toContain('Fr.')
  })
  it('Ablehnung mit Grund, HTML wird escaped', () => {
    const m = buildQuoteAnswerEmail({ ...basis, antwort: 'ablehnen', name: '<b>Max</b>', grund: 'zu teuer\n<script>x</script>' }, 'https://admin.example.ch')
    expect(m.subject).toBe('Muster AG hat Offerte OF-2026-NOV-02-2-0001 abgelehnt')
    expect(m.html).not.toContain('<script>')
    expect(m.html).not.toContain('<b>Max</b>')
    expect(m.html).toContain('&lt;script&gt;')
    expect(m.text).toContain('zu teuer')
  })
})
