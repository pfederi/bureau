import { describe, it, expect } from 'vitest'
import { computeTodos } from '@/lib/dashboard/todos'

const now = new Date('2026-10-21T12:00:00Z')
const customer = { firma_oder_name: 'Muster AG', email: 'kontakt@muster-ag.ch' }
const inv = (p: Record<string, unknown>) => ({
  id: 'i1', rechnungsnummer: 'RE-1', status: 'versendet', rechnungsdatum: '2026-08-01', betrag: 500, sent_at: '2026-08-01T10:00:00Z',
  erinnert_am: null, verrechnung_material: false, customer_id: 'c1', customer, ...p,
}) as any
const quote = (p: Record<string, unknown>) => ({
  id: 'q1', offertnummer: 'OF-1', status: 'versendet', offertdatum: '2026-09-01', gueltig_bis: '2026-10-25', betrag: 900, customer_id: 'c1', customer, ...p,
}) as any
const run = (p: Partial<Parameters<typeof computeTodos>[0]>) =>
  computeTodos({ invoices: [], quotes: [], timeEntries: [], fehlendeBelege: [], now, ...p })

describe('computeTodos', () => {
  it('lists overdue invoices first, with a reminder action', () => {
    const [t] = run({ invoices: [inv({})] })
    expect(t).toMatchObject({ art: 'erinnern', dringend: true, titel: 'RE-1 · Muster AG', erinnern: { invoiceId: 'i1', email: 'kontakt@muster-ag.ch' } })
    expect(t.detail).toBe('81 Tage offen')
  })
  it('skips invoices within the payment term and material invoices', () => {
    expect(run({ invoices: [inv({ sent_at: '2026-10-01T10:00:00Z' }), inv({ id: 'i2', verrechnung_material: true })] })).toEqual([])
  })
  it('offers no second reminder within 14 days, and none without e-mail', () => {
    const [a] = run({ invoices: [inv({ erinnert_am: '2026-10-15T10:00:00Z' })] })
    expect(a.erinnern).toBeUndefined()
    expect(a.detail).toContain('erinnert vor 6 Tagen')
    const [b] = run({ invoices: [inv({ customer: { firma_oder_name: 'X', email: null } })] })
    expect(b.erinnern).toBeUndefined()
  })
  it('flags quotes that expire soon or have expired', () => {
    expect(run({ quotes: [quote({})] })[0]).toMatchObject({ art: 'offerte', dringend: false, detail: 'läuft in 4 Tagen ab' })
    expect(run({ quotes: [quote({ gueltig_bis: '2026-10-11' })] })[0]).toMatchObject({ dringend: true })
    expect(run({ quotes: [quote({ gueltig_bis: '2026-12-01' })] })).toEqual([])
  })
  it('reports old drafts and old unbilled hours per customer', () => {
    const todos = run({
      invoices: [inv({ id: 'd1', status: 'entwurf', rechnungsdatum: '2026-10-01' }), inv({ id: 'd2', status: 'entwurf', rechnungsdatum: '2026-10-19' })],
      timeEntries: [
        { customer_id: 'c1', datum: '2026-08-10', stunden: 2, stundensatz: 180, billed: false, customer },
        { customer_id: 'c1', datum: '2026-10-10', stunden: 1.5, stundensatz: 180, billed: false, customer },
        { customer_id: 'c2', datum: '2026-10-15', stunden: 3, stundensatz: 180, billed: false, customer: { firma_oder_name: 'Neu' } },
      ] as any,
    })
    expect(todos.map(t => t.key)).toEqual(['stunden-c1', 'entwurf-d1'])
    expect(todos[0]).toMatchObject({ titel: '3.5 Std. nicht verrechnet · Muster AG', betrag: 630, href: '/admin/rechnungen/neu?kunde=c1' })
  })
  it('includes missing receipts', () => {
    const [t] = run({ fehlendeBelege: [{ key: 'k', frequenz: 'jaehrlich', lieferant: 'cyon', beschreibung: 'Domain muster.ch', kategorie: 'hosting', waehrung: 'CHF', betrag: 24.9, letztes: '2025-05-26', erwartet: '2026-05-26' }] })
    expect(t).toMatchObject({ art: 'beleg', titel: 'Beleg fehlt: Domain muster.ch', href: '/admin/ausgaben' })
  })
})

describe('computeTodos hosting', () => {
  const host = (p: Record<string, unknown>) => ({ id: 'c1', firma_oder_name: 'Muster AG', hosting_text: 'Webhosting', hosting_preis_monat: 20, hosting_ab: '2026-04', hosting_bis: null, ...p }) as any
  it('lists customers whose hosting for the year is not invoiced yet', () => {
    const [t] = run({ customers: [host({})] })
    expect(t).toMatchObject({ art: 'hosting', titel: 'Hosting 2026 noch nicht verrechnet', detail: 'Muster AG', betrag: 180, href: '/admin/rechnungen?hosting=2026', dringend: false })
  })
  it('is quiet once a non-cancelled invoice covers the year', () => {
    expect(run({ customers: [host({})], invoices: [inv({ status: 'bezahlt', hosting_jahr: 2026 })] })).toEqual([])
    expect(run({ customers: [host({})], invoices: [inv({ status: 'storniert', hosting_jahr: 2026 })] }).map(t => t.art)).toContain('hosting')
  })
  it('ignores years before hosting was billed (2026)', () => {
    expect(run({ customers: [host({ hosting_ab: '2021-01' })], invoices: [inv({ status: 'bezahlt', hosting_jahr: 2026 })] })).toEqual([])
  })
  it('flags last year as urgent', () => {
    const t = computeTodos({ invoices: [], quotes: [], timeEntries: [], fehlendeBelege: [], customers: [host({ hosting_ab: '2026-01' })], now: new Date('2027-02-01T12:00:00Z') })
    expect(t.find(x => x.key === 'hosting-2026')).toMatchObject({ titel: 'Hosting 2026 noch nicht verrechnet', dringend: true, betrag: 240 })
  })
})

describe('computeTodos budget and websites', () => {
  const c = { id: 'c1', firma_oder_name: 'Muster AG', hosting_text: null, hosting_preis_monat: null, hosting_ab: null, hosting_bis: null, stunden_budget: 10, budget_zeitraum: 'monat' } as any
  const te = (stunden: number) => ({ customer_id: 'c1', datum: '2026-10-05', stunden, stundensatz: 180, billed: true, customer })
  it('warns from 80 % of the hour budget, urgent when exceeded', () => {
    expect(run({ customers: [c], timeEntries: [te(7)] as any })).toEqual([])
    expect(run({ customers: [c], timeEntries: [te(8.5)] as any })[0]).toMatchObject({ art: 'budget', titel: 'Stundenbudget 85 % · Muster AG', dringend: false, href: '/admin/kunden/c1/konto' })
    expect(run({ customers: [c], timeEntries: [te(12)] as any })[0]).toMatchObject({ dringend: true, detail: '12 von 10 Std. (Oktober 2026) – überschritten' })
  })
  it('lists website problems with the customer name', () => {
    const s = { id: 's1', customer_id: 'c1', url: 'https://kunde.ch', geprueft_am: null, erreichbar: false, http_status: 502, antwort_ms: null, fehler: 'HTTP 502', fehlversuche: 2, down_seit: null, ssl_ablauf: null, domain_ablauf: null }
    const [t] = run({ customers: [{ ...c, stunden_budget: null }], sites: [s] })
    expect(t).toMatchObject({ art: 'website', dringend: true, titel: 'kunde.ch nicht erreichbar · Muster AG', href: '/admin/kunden/c1/konto#websites' })
  })
})
