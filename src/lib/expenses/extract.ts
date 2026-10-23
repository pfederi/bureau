import type { Currency, ExpenseCategory } from '@/lib/types'
import { EXPENSE_CATEGORIES } from './categories'

/** Vorschlag aus einem Beleg; fehlende oder unplausible Felder bleiben leer. */
export type ExtractedExpense = {
  datum?: string
  betrag?: number
  waehrung?: Currency
  lieferant?: string
  beschreibung?: string
  kategorie?: ExpenseCategory
}

export const EXTRACT_PROMPT = `Du liest Belege (Rechnungen, Quittungen) für die Buchhaltung eines Schweizer Selbständigen im Nebenerwerb.
Antworte ausschliesslich mit einem JSON-Objekt mit diesen Feldern:
- "datum": Rechnungs- bzw. Belegdatum als "YYYY-MM-DD"
- "betrag": zu bezahlender Gesamtbetrag (Brutto, inkl. MWST) als Zahl mit Punkt als Dezimaltrennzeichen
- "waehrung": "CHF", "EUR" oder "USD"
- "lieferant": Firmenname des Rechnungsstellers
- "beschreibung": kurze Beschreibung auf Deutsch, z. B. "Cloud-Server, Rechnung 080000012345"
- "kategorie": genau einer dieser Schlüssel: ${EXPENSE_CATEGORIES.map(c => `"${c.value}" (${c.label})`).join(', ')}
Lass Felder weg, die du nicht sicher erkennst. Erfinde nichts.`

const CURRENCY_ALIASES: Record<string, Currency> = {
  CHF: 'CHF', FR: 'CHF', 'FR.': 'CHF', SFR: 'CHF', EUR: 'EUR', '€': 'EUR', EURO: 'EUR', USD: 'USD', '$': 'USD', 'US$': 'USD',
}

function toAmount(v: unknown): number | undefined {
  if (typeof v === 'number') return v > 0 && Number.isFinite(v) ? Math.round(v * 100) / 100 : undefined
  if (typeof v !== 'string') return undefined
  // «1'234,50», «1.234,50», «1,234.50», «64,90 €»
  let s = v.replace(/[^\d.,']/g, '').replace(/'/g, '')
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(/,/g, '')
  const n = Number(s)
  return n > 0 && Number.isFinite(n) ? Math.round(n * 100) / 100 : undefined
}

function toDate(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim())
  const ch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v.trim())
  const [y, m, d] = iso ? [iso[1], iso[2], iso[3]] : ch ? [ch[3], ch[2].padStart(2, '0'), ch[1].padStart(2, '0')] : []
  if (!y) return undefined
  const date = new Date(`${y}-${m}-${d}T00:00:00Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== `${y}-${m}-${d}` ? undefined : `${y}-${m}-${d}`
}

const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)

/** Antwort des Modells robust auswerten (auch mit Denk-Block oder Text um das JSON herum). */
export function parseExtraction(raw: string): ExtractedExpense {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '')
  const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) return {}
  let j: Record<string, unknown>
  try { j = JSON.parse(cleaned.slice(start, end + 1)) } catch { return {} }
  const waehrung = typeof j.waehrung === 'string' ? CURRENCY_ALIASES[j.waehrung.trim().toUpperCase()] : undefined
  const kategorie = EXPENSE_CATEGORIES.find(c => c.value === j.kategorie)?.value
  const result: ExtractedExpense = {
    datum: toDate(j.datum),
    betrag: toAmount(j.betrag),
    waehrung,
    lieferant: text(j.lieferant, 120),
    beschreibung: text(j.beschreibung, 200),
    kategorie,
  }
  return Object.fromEntries(Object.entries(result).filter(([, v]) => v !== undefined)) as ExtractedExpense
}
