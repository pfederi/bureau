import type { Customer, ProjectRate, TimeEntry } from '@/lib/types'

export type AnsatzQuelle = 'projekt' | 'kunde' | 'standard'

/** Rückfrage nach einer Änderung: so viele offene Einträge haben noch den alten Ansatz. */
export type OffeneFrage = { customerId: string; projekt: string | null; alt: number; neu: number; anzahl: number }

/** Alles, was für einen Vorschlag nötig ist: Standard, Ansatz pro Kunde und pro Projekt eines Kunden. */
export type Ansaetze = {
  standard: number
  kunden: Record<string, number | null>
  projekte: Pick<ProjectRate, 'customer_id' | 'projekt' | 'stundensatz'>[]
}

type OffenerEintrag = Pick<TimeEntry, 'customer_id' | 'billed' | 'stundensatz'> & { projekt?: string | null }

const rappen = (n: number | string) => Math.round(Number(n) * 100)

/** Projektname zum Vergleichen: ohne Gross-/Kleinschreibung und Leerzeichen am Rand; leer = kein Projekt. */
export function projektSchluessel(projekt: string | null | undefined): string | null {
  const s = (projekt ?? '').trim().toLowerCase()
  return s === '' ? null : s
}

export function ansaetzeAus(standard: number, customers: Pick<Customer, 'id' | 'stundensatz'>[], projekte: Ansaetze['projekte']): Ansaetze {
  return {
    standard: Number(standard),
    kunden: Object.fromEntries(customers.map(c => [c.id, c.stundensatz == null ? null : Number(c.stundensatz)])),
    projekte,
  }
}

/** Ansatz des Projekts beim Kunden, null ohne eigenen Ansatz. */
export function projektAnsatz(projekte: Ansaetze['projekte'], customerId: string, projekt: string | null | undefined): number | null {
  const key = projektSchluessel(projekt)
  if (!key) return null
  const r = projekte.find(p => p.customer_id === customerId && projektSchluessel(p.projekt) === key)
  return r ? Number(r.stundensatz) : null
}

/** Vorschlag für einen Zeiteintrag: Projekt des Kunden → Kunde → Standard. */
export function vorgeschlagenerAnsatz(a: Ansaetze, customerId: string, projekt?: string | null): { ansatz: number; quelle: AnsatzQuelle } {
  const p = projektAnsatz(a.projekte, customerId, projekt)
  if (p !== null) return { ansatz: p, quelle: 'projekt' }
  const k = a.kunden[customerId]
  if (k != null) return { ansatz: Number(k), quelle: 'kunde' }
  return { ansatz: a.standard, quelle: 'standard' }
}

/** Satz im Formular: der aktuelle Vorschlag, bis er von Hand geändert (oder beim Duplizieren kopiert) wurde. */
export function angezeigterSatz({ satz, vonHand, vorschlag }: { satz: number; vonHand: boolean; vorschlag: number }): number {
  return vonHand ? satz : vorschlag
}

/**
 * Offene Einträge, die eine Änderung des Ansatzes mitziehen würde: nicht verrechnet, gleicher Kunde,
 * genau der bisherige Satz. Projekt-Ansatz: nur dieses Projekt. Kunden-Ansatz: ohne Projekte mit eigenem Ansatz.
 * Von Hand abweichende Sätze bleiben so unberührt.
 */
export function betroffeneOffene<T extends OffenerEintrag>(
  entries: T[],
  ziel: { customerId: string; projekt: string | null; alterAnsatz: number; projekte: Ansaetze['projekte'] },
): T[] {
  const key = projektSchluessel(ziel.projekt)
  return entries.filter(e => {
    if (e.billed || e.customer_id !== ziel.customerId || rappen(e.stundensatz) !== rappen(ziel.alterAnsatz)) return false
    if (key) return projektSchluessel(e.projekt) === key
    return projektAnsatz(ziel.projekte, ziel.customerId, e.projekt) === null
  })
}
