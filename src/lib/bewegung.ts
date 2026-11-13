/** Hilfen für Mikroanimationen (rein, ohne React). */

/**
 * Merkt sich gerade gespeicherte IDs (z. B. nach einem Dialog), damit die Zeile nach dem Neuladen
 * einmal hervorgehoben wird. Ältere Markierungen als `frist` ms verfallen.
 */
export function gespeichertSpeicher(jetzt: () => number = Date.now, frist = 5000) {
  const markiert = new Map<string, number>()
  const hoerer = new Set<(id: string) => void>()
  return {
    markiere(id: string) {
      markiert.set(id, jetzt())
      hoerer.forEach(h => h(id))
    },
    /** true, wenn die ID frisch markiert ist; verbraucht die Markierung. */
    nimm(id: string): boolean {
      const t = markiert.get(id)
      if (t === undefined) return false
      markiert.delete(id)
      return jetzt() - t <= frist
    },
    hoere(h: (id: string) => void): () => void {
      hoerer.add(h)
      return () => { hoerer.delete(h) }
    },
  }
}

/** IDs, die seit der letzten Anzeige dazugekommen sind; beim ersten Anzeigen (vorher = null) keine. */
export function neueIds(vorher: readonly string[] | null, jetzt: readonly string[]): Set<string> {
  if (!vorher) return new Set()
  const alt = new Set(vorher)
  return new Set(jetzt.filter(id => !alt.has(id)))
}

/** Wert zwischen `von` und `nach` bei Fortschritt t (0–1), mit Ausrollen (ease-out), auf Rappen gerundet. */
export function zwischenwert(von: number, nach: number, t: number): number {
  const p = Math.min(1, Math.max(0, t))
  const e = 1 - (1 - p) ** 3
  return Math.round((von + (nach - von) * e) * 100) / 100
}
