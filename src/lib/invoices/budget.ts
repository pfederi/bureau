import type { Customer, TimeEntry } from '@/lib/types'

const MONATSNAMEN = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

/** Ab diesem Anteil wird das Budget als knapp markiert. */
export const BUDGET_WARNUNG = 0.8

export type BudgetUsage = {
  budget: number
  verbraucht: number
  zeitraum: 'monat' | 'jahr'
  /** z. B. «Oktober 2026» oder «2026» */
  label: string
  /** 0–1, gedeckelt */
  anteil: number
  stufe: 'ok' | 'knapp' | 'ueberschritten'
}

/** Verbrauch des Stundenbudgets im laufenden Monat bzw. Jahr (alle Einträge, verrechnet oder nicht). */
export function budgetUsage(
  c: Pick<Customer, 'id' | 'stunden_budget' | 'budget_zeitraum'>,
  entries: Pick<TimeEntry, 'customer_id' | 'datum' | 'stunden'>[],
  now: Date,
): BudgetUsage | null {
  const budget = Number(c.stunden_budget ?? 0)
  if (budget <= 0) return null
  const zeitraum = c.budget_zeitraum ?? 'monat'
  const jahr = now.getUTCFullYear()
  const monat = now.getUTCMonth()
  const prefix = zeitraum === 'jahr' ? String(jahr) : `${jahr}-${String(monat + 1).padStart(2, '0')}`
  const verbraucht = Math.round(
    entries.filter(e => e.customer_id === c.id && e.datum.startsWith(prefix)).reduce((s, e) => s + Number(e.stunden), 0) * 100,
  ) / 100
  const roh = verbraucht / budget
  return {
    budget,
    verbraucht,
    zeitraum,
    label: zeitraum === 'jahr' ? String(jahr) : `${MONATSNAMEN[monat]} ${jahr}`,
    anteil: Math.min(1, roh),
    stufe: roh > 1 ? 'ueberschritten' : roh >= BUDGET_WARNUNG ? 'knapp' : 'ok',
  }
}
