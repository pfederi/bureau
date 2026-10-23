import { describe, it, expect } from 'vitest'
import {
  allocateCredits, groupAccount, computeAccount, accountTimeline, accountStatusUpdates, coveredAmounts, computeCustomerOwed,
  type AccountInvoice, type AccountCredit,
} from '@/lib/invoices/account'

function inv(p: Partial<AccountInvoice>): AccountInvoice {
  return {
    id: 'i', customer_id: 'ww', rechnungsnummer: 'RE-1', rechnungsdatum: '2026-01-15', betrag: 0,
    status: 'versendet', paid_at: null, verrechnung_material: true, ...p,
  }
}
function cr(p: Partial<AccountCredit>): AccountCredit {
  return {
    id: 'c', customer_id: 'ww', datum: '2026-02-01', typ: 'material', beschreibung: 'Foil',
    betrag: 0, created_at: '2026-02-01T10:00:00Z', ...p,
  }
}

const r1 = inv({ id: 'r1', rechnungsnummer: 'RE-1', rechnungsdatum: '2026-01-15', betrag: 2400 })
const r2 = inv({ id: 'r2', rechnungsnummer: 'RE-2', rechnungsdatum: '2026-03-10', betrag: 1800 })

describe('allocateCredits', () => {
  it('covers invoices oldest first and leaves the rest open', () => {
    const c = allocateCredits([r2, r1], [cr({ id: 'a', betrag: 1200, datum: '2026-02-03' }), cr({ id: 'b', betrag: 1500, datum: '2026-04-22' })])
    expect(c.map(x => [x.invoice.id, x.gedeckt, x.rest, x.gedecktAm])).toEqual([
      ['r1', 2400, 0, '2026-04-22'],
      ['r2', 300, 1500, null],
    ])
  })

  it('ignores drafts, cancelled invoices and invoices not settled via the account', () => {
    const c = allocateCredits(
      [r1, inv({ id: 'd', status: 'entwurf', betrag: 500 }), inv({ id: 's', status: 'storniert', betrag: 700 }), inv({ id: 'n', verrechnung_material: false, betrag: 900 })],
      [cr({ betrag: 100 })],
    )
    expect(c.map(x => x.invoice.id)).toEqual(['r1'])
  })

  it('never dates coverage before the invoice date (material taken in advance)', () => {
    const [c] = allocateCredits([r1], [cr({ betrag: 2400, datum: '2025-12-01' })])
    expect(c.gedecktAm).toBe('2026-01-15')
  })

  it('handles cent amounts without float errors', () => {
    const [c] = allocateCredits([inv({ betrag: 0.3 })], [cr({ id: 'a', betrag: 0.1 }), cr({ id: 'b', betrag: 0.2 })])
    expect(c.rest).toBe(0)
  })
})

describe('computeAccount', () => {
  it('computes the balance (positive = customer owes)', () => {
    const a = computeAccount([r1, r2], [cr({ betrag: 1200 }), cr({ id: 'b', betrag: 1500 })])
    expect(a.totalRechnungen).toBe(4200)
    expect(a.totalGutschriften).toBe(2700)
    expect(a.saldo).toBe(1500)
  })

  it('goes negative when more material was taken than invoiced', () => {
    expect(computeAccount([r1], [cr({ betrag: 3000 })]).saldo).toBe(-600)
  })
})

describe('accountTimeline', () => {
  it('orders by date with running balance, invoices before credits on the same day', () => {
    const t = accountTimeline([r1], [cr({ id: 'same', betrag: 400, datum: '2026-01-15' }), cr({ id: 'later', betrag: 100, datum: '2026-01-20' })])
    expect(t.map(e => [e.key, e.betrag, e.saldo])).toEqual([
      ['i-r1', 2400, 2400],
      ['c-same', -400, 2000],
      ['c-later', -100, 1900],
    ])
  })
})

describe('accountStatusUpdates', () => {
  it('marks fully covered invoices as paid on the covering date', () => {
    const u = accountStatusUpdates(allocateCredits([r1], [cr({ betrag: 2400, datum: '2026-02-03' })]))
    expect(u).toEqual([{ id: 'r1', status: 'bezahlt', paid_at: '2026-02-03' }])
  })

  it('reverts paid invoices that are no longer covered (credit deleted)', () => {
    const paid = inv({ id: 'p', betrag: 100, status: 'bezahlt', paid_at: '2026-02-03T00:00:00+00:00' })
    expect(accountStatusUpdates(allocateCredits([paid], []))).toEqual([{ id: 'p', status: 'versendet', paid_at: null }])
  })

  it('does nothing when status and date already match', () => {
    const paid = inv({ id: 'p', betrag: 100, status: 'bezahlt', paid_at: '2026-02-03T00:00:00+00:00' })
    expect(accountStatusUpdates(allocateCredits([paid], [cr({ betrag: 100, datum: '2026-02-03' })]))).toEqual([])
  })
})

describe('coveredAmounts', () => {
  it('allocates per customer', () => {
    const m = coveredAmounts(
      [r1, inv({ id: 'x', customer_id: 'other', betrag: 500 })],
      [cr({ betrag: 1000 }), cr({ id: 'o', customer_id: 'other', betrag: 200 })],
    )
    expect(m.get('r1')).toBe(1000)
    expect(m.get('x')).toBe(200)
  })
})

describe('computeCustomerOwed', () => {
  const normal = (id: string, status: 'versendet' | 'bezahlt', betrag: number) =>
    ({ id, rechnungsnummer: id, rechnungsdatum: '2026-05-01', betrag, status, paid_at: null })

  it('adds the open account balance and open regular invoices', () => {
    const o = computeCustomerOwed(1500, [normal('a', 'versendet', 1200), normal('b', 'bezahlt', 800)])
    expect(o).toEqual({ konto: 1500, guthaben: 0, offeneRechnungen: 1200, offeneAnzahl: 1, total: 2700 })
  })

  it('does not offset a material credit against regular invoices', () => {
    const o = computeCustomerOwed(-600, [normal('a', 'versendet', 1200)])
    expect(o).toEqual({ konto: 0, guthaben: 600, offeneRechnungen: 1200, offeneAnzahl: 1, total: 1200 })
  })
})

describe('groupAccount', () => {
  const parts = (g: { parts: { credit: AccountCredit; betrag: number; teil: boolean }[] }) =>
    g.parts.map(p => [p.credit.id, p.betrag, p.teil])

  it('assigns each credit to the invoice it covers, oldest first', () => {
    const { gruppen, uebrig } = groupAccount([r2, r1], [
      cr({ id: 'a', betrag: 1000, datum: '2026-02-01' }),
      cr({ id: 'b', betrag: 1400, datum: '2026-02-05' }),
      cr({ id: 'c', betrag: 500, datum: '2026-04-01' }),
    ])
    expect(gruppen.map(g => g.coverage.invoice.id)).toEqual(['r1', 'r2'])
    expect(parts(gruppen[0])).toEqual([['a', 1000, false], ['b', 1400, false]])
    expect(parts(gruppen[1])).toEqual([['c', 500, false]])
    expect(gruppen[1].coverage.rest).toBe(1300)
    expect(uebrig).toEqual([])
  })

  it('splits a credit across two invoices and keeps the rest as surplus', () => {
    const { gruppen, uebrig } = groupAccount([r1, r2], [
      cr({ id: 'a', betrag: 3000, datum: '2026-03-15' }),
      cr({ id: 'b', betrag: 1500, datum: '2026-04-01' }),
      cr({ id: 'c', betrag: 200, datum: '2026-05-01' }),
    ])
    expect(parts(gruppen[0])).toEqual([['a', 2400, true]])
    expect(parts(gruppen[1])).toEqual([['a', 600, true], ['b', 1200, true]])
    expect(uebrig.map(p => [p.credit.id, p.betrag, p.teil])).toEqual([['b', 300, true], ['c', 200, false]])
  })

  it('lists all credits as surplus without account invoices', () => {
    const { gruppen, uebrig } = groupAccount([inv({ verrechnung_material: false, betrag: 500 })], [cr({ id: 'a', betrag: 80 })])
    expect(gruppen).toEqual([])
    expect(uebrig.map(p => p.betrag)).toEqual([80])
  })

  it('matches allocateCredits', () => {
    const credits = [cr({ id: 'a', betrag: 1999.99 }), cr({ id: 'b', betrag: 0.02, datum: '2026-05-01' })]
    expect(groupAccount([r1, r2], credits).gruppen.map(g => g.coverage)).toEqual(allocateCredits([r1, r2], credits))
  })
})
