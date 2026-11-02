import { describe, it, expect } from 'vitest'
import {
  zuBezahlen, guthabenSaldo, anrechnungFuer, guthabenQuellen, planAnrechnung, guthabenVerlauf,
  type GuthabenEintrag, type GuthabenRechnung,
} from '@/lib/invoices/guthaben'

const eintrag = (id: string, datum: string, betrag: number, beschreibung: string): GuthabenEintrag =>
  ({ id, datum, betrag, beschreibung, created_at: `${datum}T10:00:00Z` })
const rechnung = (id: string, status: GuthabenRechnung['status'], angerechnet: number, datum = '2026-10-01'): GuthabenRechnung =>
  ({ id, status, rechnungsnummer: `RE-${id}`, rechnungsdatum: datum, guthaben_angerechnet: angerechnet })

describe('zuBezahlen', () => {
  it('subtracts the credit and never goes below zero', () => {
    expect(zuBezahlen({ betrag: 400, guthaben_angerechnet: 100 })).toBe(300)
    expect(zuBezahlen({ betrag: 400 })).toBe(400)
    expect(zuBezahlen({ betrag: 80.1, guthaben_angerechnet: 0.2 })).toBe(79.9)
    expect(zuBezahlen({ betrag: 50, guthaben_angerechnet: 60 })).toBe(0)
  })
})

describe('guthabenSaldo', () => {
  const eintraege = [eintrag('a', '2026-09-01', 100, 'Überzahlung RE-1'), eintrag('b', '2026-09-10', 50.5, 'Überzahlung RE-2')]

  it('counts drafts and sent invoices, but frees cancelled ones', () => {
    const invoices = [rechnung('x', 'versendet', 60), rechnung('y', 'entwurf', 20), rechnung('z', 'storniert', 70)]
    expect(guthabenSaldo(eintraege, invoices)).toBe(70.5)
  })

  it('leaves out the invoice being recalculated', () => {
    const invoices = [rechnung('x', 'versendet', 60), rechnung('y', 'entwurf', 20)]
    expect(guthabenSaldo(eintraege, invoices, 'y')).toBe(90.5)
  })
})

describe('anrechnungFuer', () => {
  it('is capped by the available credit and by the invoice amount', () => {
    expect(anrechnungFuer(100, 400)).toBe(100)
    expect(anrechnungFuer(500, 400)).toBe(400)
    expect(anrechnungFuer(0, 400)).toBe(0)
    expect(anrechnungFuer(-5, 400)).toBe(0)
  })
})

describe('guthabenQuellen', () => {
  const eintraege = [eintrag('b', '2026-09-10', 50, 'Überzahlung RE-2'), eintrag('a', '2026-09-01', 100, 'Überzahlung RE-1')]

  it('uses the oldest credit first', () => {
    expect(guthabenQuellen(eintraege, 0, 80)).toEqual(['Überzahlung RE-1'])
    expect(guthabenQuellen(eintraege, 0, 120)).toEqual(['Überzahlung RE-1', 'Überzahlung RE-2'])
  })

  it('skips what other invoices already used', () => {
    expect(guthabenQuellen(eintraege, 100, 30)).toEqual(['Überzahlung RE-2'])
    expect(guthabenQuellen(eintraege, 90, 30)).toEqual(['Überzahlung RE-1', 'Überzahlung RE-2'])
  })
})

describe('planAnrechnung', () => {
  const eintraege = [eintrag('a', '2026-09-01', 100, 'Überzahlung RE-1')]

  it('credits up to the available amount with its origin', () => {
    expect(planAnrechnung(eintraege, [], { id: 'n', betrag: 400 })).toEqual({ betrag: 100, text: 'Überzahlung RE-1' })
    expect(planAnrechnung(eintraege, [], { id: 'n', betrag: 40 })).toEqual({ betrag: 40, text: 'Überzahlung RE-1' })
  })

  it('recalculates its own amount instead of counting it twice', () => {
    const invoices = [rechnung('n', 'entwurf', 100)]
    expect(planAnrechnung(eintraege, invoices, { id: 'n', betrag: 300 })).toEqual({ betrag: 100, text: 'Überzahlung RE-1' })
  })

  it('returns nothing when the credit is used up', () => {
    const invoices = [rechnung('x', 'bezahlt', 100)]
    expect(planAnrechnung(eintraege, invoices, { id: 'n', betrag: 300 })).toEqual({ betrag: 0, text: null })
  })
})

describe('guthabenVerlauf', () => {
  it('lists credits and usage with a running balance', () => {
    const eintraege = [eintrag('a', '2026-09-01', 100, 'Überzahlung RE-1')]
    const invoices = [rechnung('x', 'versendet', 60, '2026-09-01'), rechnung('z', 'storniert', 40)]
    const v = guthabenVerlauf(eintraege, invoices)
    expect(v.map(z => [z.text, z.betrag, z.saldo])).toEqual([
      ['Überzahlung RE-1', 100, 100],
      ['Angerechnet an RE-x', -60, 40],
    ])
  })
})
