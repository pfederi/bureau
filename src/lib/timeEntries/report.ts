import type { TimeEntry } from '@/lib/types'

/**
 * Stundenrapport pro Kunde und Monat (nur Stunden, ohne Beträge) – wird nur
 * auf Knopfdruck an den Kunden geschickt.
 */

const MONATSNAMEN = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

type ReportEntry = Pick<TimeEntry, 'datum' | 'beschreibung' | 'stunden'> & Partial<Pick<TimeEntry, 'projekt'>>

export type TimeReport = {
  /** YYYY-MM */
  monat: string
  label: string
  eintraege: ReportEntry[]
  total: number
  /** Nur wenn Einträge Projekten zugeordnet sind */
  proProjekt: { projekt: string; stunden: number }[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function isMonth(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s)
}

/** «2026-09» → «September 2026» */
export function monthLabel(monat: string): string {
  const [j, m] = monat.split('-').map(Number)
  return `${MONATSNAMEN[m - 1]} ${j}`
}

/** Monate mit Einträgen, neueste zuerst, mit Stunden. */
export function reportMonths(entries: Pick<TimeEntry, 'datum' | 'stunden'>[]): { monat: string; label: string; stunden: number; anzahl: number }[] {
  const map = new Map<string, { stunden: number; anzahl: number }>()
  for (const e of entries) {
    const m = e.datum.slice(0, 7)
    const r = map.get(m) ?? { stunden: 0, anzahl: 0 }
    r.stunden += Number(e.stunden)
    r.anzahl++
    map.set(m, r)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monat, r]) => ({ monat, label: monthLabel(monat), stunden: round2(r.stunden), anzahl: r.anzahl }))
}

/** Vorschlag: Vormonat, falls er Einträge hat, sonst der neueste Monat mit Einträgen. */
export function defaultReportMonth(months: { monat: string }[], now: Date): string | null {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const vormonat = d.toISOString().slice(0, 7)
  return months.find(m => m.monat === vormonat)?.monat ?? months[0]?.monat ?? null
}

export function buildTimeReport(entries: ReportEntry[], monat: string): TimeReport {
  const eintraege = entries
    .filter(e => e.datum.startsWith(`${monat}-`))
    .sort((a, b) => a.datum.localeCompare(b.datum))
  const projekte = new Map<string, number>()
  for (const e of eintraege) if (e.projekt) projekte.set(e.projekt, (projekte.get(e.projekt) ?? 0) + Number(e.stunden))
  return {
    monat,
    label: monthLabel(monat),
    eintraege,
    total: round2(eintraege.reduce((s, e) => s + Number(e.stunden), 0)),
    proProjekt: projekte.size > 0
      ? Array.from(projekte.entries()).map(([projekt, stunden]) => ({ projekt, stunden: round2(stunden) })).sort((a, b) => b.stunden - a.stunden)
      : [],
  }
}

export function timeReportFileBase(monat: string, kunde: string): string {
  return `Stundenrapport-${monat}-${kunde.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')}`
}
