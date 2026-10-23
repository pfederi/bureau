import { describe, it, expect } from 'vitest'
import { budgetUsage } from '@/lib/invoices/budget'

const now = new Date(Date.UTC(2026, 9, 21))
const entries = [
  { customer_id: 'ww', datum: '2026-10-02', stunden: 10 },
  { customer_id: 'ww', datum: '2026-10-20', stunden: 7 },
  { customer_id: 'ww', datum: '2026-09-15', stunden: 5 },
  { customer_id: 'ac', datum: '2026-10-05', stunden: 99 },
]

describe('budgetUsage', () => {
  it('returns null without a budget', () => {
    expect(budgetUsage({ id: 'ww', stunden_budget: null, budget_zeitraum: null }, entries, now)).toBeNull()
  })

  it('counts the current month and flags 80 % as tight', () => {
    expect(budgetUsage({ id: 'ww', stunden_budget: 20, budget_zeitraum: 'monat' }, entries, now)).toEqual({
      budget: 20, verbraucht: 17, zeitraum: 'monat', label: 'Oktober 2026', anteil: 0.85, stufe: 'knapp',
    })
  })

  it('counts the whole year and flags overruns', () => {
    const u = budgetUsage({ id: 'ww', stunden_budget: 20, budget_zeitraum: 'jahr' }, entries, now)!
    expect([u.verbraucht, u.label, u.stufe]).toEqual([22, '2026', 'ueberschritten'])
    expect(u.anteil).toBe(1)
  })
})
