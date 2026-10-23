import type { Currency, Expense, ExpenseCategory } from '@/lib/types'

/**
 * Wiederkehrende Ausgaben (z. B. Cloud-Server monatlich, Domains jährlich) erkennen und
 * melden, wenn der nächste Beleg überfällig ist. Eine Reihe sind Ausgaben mit gleichem
 * Lieferanten und gleicher Beschreibung ohne Rechnungsnummer.
 */

export type Frequenz = 'monatlich' | 'jaehrlich'

export type MissingRecurring = {
  key: string
  frequenz: Frequenz
  lieferant: string | null
  /** Beschreibung ohne Rechnungsnummer, z. B. «Cloud-Server» */
  beschreibung: string
  kategorie: ExpenseCategory
  waehrung: Currency
  /** Letzter Betrag in der Originalwährung (bei CHF = Franken) */
  betrag: number
  letztes: string
  erwartet: string
}

type RecurringExpense = Pick<Expense, 'datum' | 'lieferant' | 'beschreibung' | 'kategorie' | 'waehrung' | 'betrag' | 'betrag_original'>

const RECHTSFORM = /\b(gmbh|ag|sa|sarl|ltd|inc|llc|online|co\.?)\b/g

export function seriesKey(e: Pick<Expense, 'lieferant' | 'beschreibung'>): string {
  const lieferant = (e.lieferant ?? '').toLowerCase().replace(RECHTSFORM, '').replace(/[^a-z0-9äöü]+/g, ' ').trim()
  return `${lieferant}|${cleanDescription(e.beschreibung).toLowerCase()}`
}

/** «Cloud-Server, Rechnung 080000012345» → «Cloud-Server» */
export function cleanDescription(text: string): string {
  return text
    .replace(/,?\s*(rechnung|rechnungsnr\.?|invoice|beleg)\s*(nr\.?)?\s*[\w-]*\d[\w-]*/gi, '')
    .replace(/\b\d{5,}\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s,;–-]+$/, '')
    .trim()
}

const DAY = 86_400_000
const toDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`)
const iso = (d: Date) => d.toISOString().slice(0, 10)

function addMonths(isoDate: string, months: number): string {
  const d = toDate(isoDate)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return iso(d)
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// Kulanz bis zur Meldung und wie lange eine Lücke noch als «fehlt» statt «gekündigt» gilt
const REGELN: Record<Frequenz, { monate: number; kulanzTage: number; maxMonateUeberfaellig: number }> = {
  monatlich: { monate: 1, kulanzTage: 10, maxMonateUeberfaellig: 3 },
  jaehrlich: { monate: 12, kulanzTage: 30, maxMonateUeberfaellig: 11 },
}

/**
 * Kennung zum Ausblenden: Reihe plus letzter Beleg. Kommt ein neuer Beleg dazu,
 * gilt die Reihe wieder als aktiv und meldet sich beim nächsten Ausbleiben erneut.
 */
export const hideId = (m: Pick<MissingRecurring, 'key' | 'letztes'>) => `${m.key}@${m.letztes}`

export function findMissingRecurring(expenses: RecurringExpense[], today: Date, ausgeblendet: readonly string[] = []): MissingRecurring[] {
  const reihen = new Map<string, RecurringExpense[]>()
  for (const e of expenses) {
    const k = seriesKey(e)
    if (!cleanDescription(e.beschreibung)) continue
    reihen.set(k, [...(reihen.get(k) ?? []), e])
  }

  const heute = toDate(iso(today))
  const result: MissingRecurring[] = []
  for (const [key, list] of Array.from(reihen.entries())) {
    if (list.length < 2) continue
    const sorted = [...list].sort((a, b) => a.datum.localeCompare(b.datum))
    const abstaende = sorted.slice(1).map((e, i) => (toDate(e.datum).getTime() - toDate(sorted[i].datum).getTime()) / DAY)
    const m = median(abstaende)
    const frequenz: Frequenz | null = m >= 20 && m <= 40 ? 'monatlich' : m >= 330 && m <= 400 ? 'jaehrlich' : null
    if (!frequenz) continue

    const regel = REGELN[frequenz]
    const letztes = sorted[sorted.length - 1]
    const erwartet = addMonths(letztes.datum, regel.monate)
    const faellig = toDate(erwartet).getTime() + regel.kulanzTage * DAY
    const aufgegeben = toDate(addMonths(erwartet, regel.maxMonateUeberfaellig)).getTime()
    if (heute.getTime() <= faellig || heute.getTime() > aufgegeben) continue
    if (ausgeblendet.includes(hideId({ key, letztes: letztes.datum }))) continue

    result.push({
      key,
      frequenz,
      lieferant: letztes.lieferant,
      beschreibung: cleanDescription(letztes.beschreibung),
      kategorie: letztes.kategorie,
      waehrung: letztes.waehrung,
      betrag: Number(letztes.waehrung === 'CHF' ? letztes.betrag : letztes.betrag_original ?? letztes.betrag),
      letztes: letztes.datum,
      erwartet,
    })
  }
  return result.sort((a, b) => a.erwartet.localeCompare(b.erwartet))
}
