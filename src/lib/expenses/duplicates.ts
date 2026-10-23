import type { Expense } from '@/lib/types'

export type DuplicateCandidate = Pick<Expense, 'datum' | 'betrag' | 'waehrung' | 'betrag_original' | 'beschreibung' | 'beleg_name'> & { id?: string }
export type DuplicateMatch = { expense: Expense; grund: string }

/** Rechnungs-/Belegnummern: Ziffernfolgen ab 6 Stellen oder Kürzel wie «RE-2026-OCT-16-43-0002». */
export function documentNumbers(text: string): string[] {
  const found: string[] = text.match(/\b(?:[A-Z]{2,}[-/]?[\dA-Z-]*\d[\dA-Z-]*|\d{6,})\b/g) ?? []
  return Array.from(new Set(found.filter(n => /\d{4,}/.test(n.replace(/\D/g, '')) && n.length >= 6)))
}

const sameCents = (a: number | null | undefined, b: number | null | undefined) =>
  a != null && b != null && Math.round(Number(a) * 100) === Math.round(Number(b) * 100)

/** Mögliche Duplikate einer neuen oder bearbeiteten Ausgabe (sich selbst ausgenommen). */
export function findDuplicates(c: DuplicateCandidate, existing: Expense[]): DuplicateMatch[] {
  const nummern = documentNumbers(c.beschreibung ?? '')
  const matches: DuplicateMatch[] = []
  for (const e of existing) {
    if (c.id && e.id === c.id) continue
    const gleicheNummer = nummern.find(n => documentNumbers(e.beschreibung).includes(n))
    if (gleicheNummer) { matches.push({ expense: e, grund: `gleiche Belegnummer ${gleicheNummer}` }); continue }
    if (c.beleg_name && e.beleg_name && c.beleg_name === e.beleg_name) { matches.push({ expense: e, grund: 'gleiche Beleg-Datei' }); continue }
    const gleicherBetrag = c.waehrung !== 'CHF' && e.waehrung === c.waehrung
      ? sameCents(e.betrag_original, c.betrag_original)
      : sameCents(e.betrag, c.betrag)
    if (c.datum && e.datum === c.datum && gleicherBetrag) matches.push({ expense: e, grund: 'gleiches Datum und gleicher Betrag' })
  }
  return matches
}
