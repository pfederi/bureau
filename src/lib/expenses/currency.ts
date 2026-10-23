import type { Currency } from '@/lib/types'

export const CURRENCIES: { value: Currency; label: string }[] = [
  { value: 'CHF', label: 'CHF – Franken' },
  { value: 'EUR', label: 'EUR – Euro' },
  { value: 'USD', label: 'USD – Dollar' },
]

/** Umrechnung in Franken, auf Rappen gerundet. */
export function toChf(betrag: number, kurs: number): number {
  return Math.round(betrag * kurs * 100) / 100
}

export type ChfRate = { kurs: number; datum: string; quelle: string }

/** EZB-Referenzkurs (über Frankfurter); am Wochenende gilt der letzte Handelstag. */
export function rateUrl(waehrung: Exclude<Currency, 'CHF'>, datum: string): string {
  return `https://api.frankfurter.dev/v1/${datum}?base=${waehrung}&symbols=CHF`
}

export function parseRate(json: unknown): ChfRate | null {
  const j = json as { date?: string; rates?: { CHF?: number } }
  const kurs = j?.rates?.CHF
  return typeof kurs === 'number' && kurs > 0 && j.date ? { kurs, datum: j.date, quelle: 'EZB-Referenzkurs' } : null
}
