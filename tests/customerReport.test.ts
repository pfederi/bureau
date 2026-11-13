import { describe, it, expect } from 'vitest'
import { dominanterKunde, kundenAuswertung, sortiereZeilen } from '@/lib/invoices/customerReport'

const r = (p: Record<string, unknown>) => ({
  id: 'r', customer_id: 'k1', status: 'bezahlt', betrag: 1000, rabatt_prozent: 0, rechnungsdatum: '2026-03-01',
  sent_at: '2026-03-01T10:00:00Z', paid_at: '2026-03-21', verrechnung_material: false, guthaben_angerechnet: 0,
  customer: { firma_oder_name: 'Muster AG' }, ...p,
}) as any
const e = (p: Record<string, unknown>) => ({ invoice_id: 'r', stunden: 1, stundensatz: 100, ...p }) as any

describe('kundenAuswertung', () => {
  it('zählt versendete und bezahlte Rechnungen des Jahres, ohne Entwürfe und Stornos', () => {
    const a = kundenAuswertung([
      r({ id: 'a', betrag: 1000 }),
      r({ id: 'b', betrag: 500, status: 'versendet', paid_at: null }),
      r({ id: 'c', betrag: 700, status: 'entwurf' }),
      r({ id: 'd', betrag: 900, status: 'storniert' }),
      r({ id: 'e', betrag: 300, rechnungsdatum: '2025-12-31' }),
    ], [], 2026)
    expect(a.zeilen).toHaveLength(1)
    expect(a.zeilen[0]).toMatchObject({ customerId: 'k1', kunde: 'Muster AG', umsatz: 1500, anteil: 100, offen: 500 })
  })
  it('alle Jahre mit jahr = null', () => {
    const a = kundenAuswertung([r({ id: 'a' }), r({ id: 'e', betrag: 300, rechnungsdatum: '2024-05-01' })], [], null)
    expect(a.total.umsatz).toBe(1300)
  })
  it('offen ohne angerechnetes Guthaben und ohne über das Konto gedeckten Teil, nie negativ', () => {
    const a = kundenAuswertung([
      r({ id: 'a', status: 'versendet', paid_at: null, betrag: 1000, guthaben_angerechnet: 200 }),
      r({ id: 'b', status: 'versendet', paid_at: null, betrag: 400 }),
    ], [], 2026, new Map([['b', 500]]))
    expect(a.zeilen[0].offen).toBe(800)
  })
  it('Stunden und effektiver Ansatz nach Rabatt, Stornos zählen nicht', () => {
    const a = kundenAuswertung([
      r({ id: 'a', rabatt_prozent: 10 }),
      r({ id: 'x', status: 'storniert' }),
    ], [e({ invoice_id: 'a', stunden: 2, stundensatz: 100 }), e({ invoice_id: 'a', stunden: 1, stundensatz: 130 }), e({ invoice_id: 'x', stunden: 5 })], 2026)
    // (200 + 130) × 0.9 / 3 = 99
    expect(a.zeilen[0]).toMatchObject({ stunden: 3, ansatzEffektiv: 99 })
  })
  it('ohne Stunden: Ansatz null', () => {
    expect(kundenAuswertung([r({ id: 'a' })], [], 2026).zeilen[0].ansatzEffektiv).toBeNull()
  })
  it('Zahlungsdauer ab Versand, sonst ab Rechnungsdatum; ohne Material-Verrechnung; nie negativ', () => {
    const a = kundenAuswertung([
      r({ id: 'a', sent_at: '2026-03-01T10:00:00Z', paid_at: '2026-03-21' }),          // 20 Tage
      r({ id: 'b', sent_at: null, rechnungsdatum: '2026-04-01', paid_at: '2026-05-11' }), // 40 Tage
      r({ id: 'c', verrechnung_material: true, paid_at: '2026-12-31' }),                 // zählt nicht
      r({ id: 'd', sent_at: '2026-06-10T08:00:00Z', paid_at: '2026-06-01' }),           // vor Versand → 0
    ], [], 2026)
    expect(a.zeilen[0]).toMatchObject({ zahlungTage: 20, zahlungAnzahl: 3 })
  })
  it('zählt Kalendertage in Zürcher Zeit, nicht gerundete Stunden', () => {
    // Mo 08:00 bis Mi 21:00 (Zürich) = 2 Tage
    const a = kundenAuswertung([r({ id: 'a', sent_at: '2026-03-02T07:00:00Z', paid_at: '2026-03-04T20:00:00Z' })], [], 2026)
    expect(a.zeilen[0].zahlungTage).toBe(2)
  })
  it('ganz mit Guthaben beglichene Rechnungen zählen nicht zur Zahlungsdauer', () => {
    const a = kundenAuswertung([
      r({ id: 'a', sent_at: '2026-03-01T10:00:00Z', paid_at: '2026-03-21' }),
      r({ id: 'b', betrag: 500, guthaben_angerechnet: 500, sent_at: '2026-04-01T10:00:00Z', paid_at: '2026-04-01T10:00:05Z' }),
    ], [], 2026)
    expect(a.zeilen[0]).toMatchObject({ zahlungTage: 20, zahlungAnzahl: 1 })
  })
  it('Anteil, Total und Reihenfolge nach Umsatz; unbekannter Kunde', () => {
    const a = kundenAuswertung([
      r({ id: 'a', betrag: 1000 }),
      r({ id: 'b', customer_id: 'k2', betrag: 3000, customer: null }),
    ], [], 2026)
    expect(a.zeilen.map(z => [z.kunde, z.anteil])).toEqual([['Unbekannt', 75], ['Muster AG', 25]])
    expect(a.total).toMatchObject({ umsatz: 4000, anteil: 100 })
  })
})

describe('sortiereZeilen', () => {
  const a = kundenAuswertung([
    r({ id: 'a', betrag: 1000, customer: { firma_oder_name: 'Beta' } }),
    r({ id: 'b', customer_id: 'k2', betrag: 3000, customer: { firma_oder_name: 'Alpha' } }),
    r({ id: 'c', customer_id: 'k3', betrag: 2000, customer: { firma_oder_name: 'Gamma' } }),
  ], [e({ invoice_id: 'a', stunden: 2, stundensatz: 100 }), e({ invoice_id: 'c', stunden: 1, stundensatz: 150 })], 2026)
  it('nach Kunde aufsteigend', () => {
    expect(sortiereZeilen(a.zeilen, { spalte: 'kunde', richtung: 'auf' }).map(z => z.kunde)).toEqual(['Alpha', 'Beta', 'Gamma'])
  })
  it('Zeilen ohne Wert stehen in beiden Richtungen unten', () => {
    expect(sortiereZeilen(a.zeilen, { spalte: 'ansatz', richtung: 'ab' }).map(z => z.kunde)).toEqual(['Gamma', 'Beta', 'Alpha'])
    expect(sortiereZeilen(a.zeilen, { spalte: 'ansatz', richtung: 'auf' }).map(z => z.kunde)).toEqual(['Beta', 'Gamma', 'Alpha'])
    expect(sortiereZeilen(a.zeilen, { spalte: 'stunden', richtung: 'auf' }).map(z => z.kunde)).toEqual(['Gamma', 'Beta', 'Alpha'])
  })
})

describe('dominanterKunde', () => {
  it('erst über 50 %', () => {
    const genau = kundenAuswertung([r({ id: 'a', betrag: 500 }), r({ id: 'b', customer_id: 'k2', betrag: 500 })], [], 2026)
    expect(dominanterKunde(genau)).toBeNull()
    const mehr = kundenAuswertung([r({ id: 'a', betrag: 510 }), r({ id: 'b', customer_id: 'k2', betrag: 490 })], [], 2026)
    expect(dominanterKunde(mehr)?.customerId).toBe('k1')
  })
})
