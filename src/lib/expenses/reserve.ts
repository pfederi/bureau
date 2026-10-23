import { ahvGrenze } from '@/lib/expenses/report'

/**
 * Rücklage für AHV/IV/EO und Einkommenssteuer auf dem Gewinn aus selbständigem
 * Nebenerwerb – eine Schätzung, keine Veranlagung.
 * AHV-Ansätze: Merkblatt 2.02 „Beiträge der Selbstständigerwerbenden“, Stand 1. Januar 2026.
 */

/** Sinkende Beitragsskala 2026: Einkommen ab … → Satz (AHV/IV/EO zusammen) */
const SKALA_2026: [number, number][] = [
  [10_100, 5.371], [17_600, 5.494], [23_000, 5.617], [25_500, 5.741], [28_000, 5.864],
  [30_500, 5.987], [33_000, 6.235], [35_500, 6.481], [38_000, 6.728], [40_500, 6.976],
  [43_000, 7.222], [45_500, 7.469], [48_000, 7.840], [50_500, 8.209], [53_000, 8.580],
  [55_500, 8.951], [58_000, 9.321], [60_500, 10.0],
]
const MINDESTBEITRAG = 530
const MIN_SATZ = 5.371
/** Verwaltungskosten der Ausgleichskasse: höchstens 5 % der Beiträge */
const VERWALTUNGSKOSTEN = 0.05

export type AhvEstimate = { satz: number; beitrag: number; verwaltungskosten: number; hinweis: string }

/**
 * AHV/IV/EO-Beitrag auf dem Einkommen aus selbständiger Tätigkeit.
 * `angestellt`: Mindestbeitrag ist schon über den Lohn bezahlt → unter der unteren Grenze nur 5.371 %.
 */
export function ahvBeitrag(einkommen: number, jahr: number, angestellt = true): AhvEstimate {
  const r = (satz: number, beitrag: number, hinweis: string): AhvEstimate => ({
    satz, beitrag: round2(beitrag), verwaltungskosten: round2(beitrag * VERWALTUNGSKOSTEN), hinweis,
  })
  if (einkommen <= 0) return r(0, 0, 'Kein Gewinn, keine Beiträge.')
  if (einkommen <= ahvGrenze(jahr)) return r(0, 0, `Nebenerwerb bis Fr. ${ahvGrenze(jahr)}: Beiträge nur auf Wunsch.`)
  if (einkommen < SKALA_2026[0][0]) {
    return angestellt
      ? r(MIN_SATZ, einkommen * MIN_SATZ / 100, 'Unter Fr. 10 100 mit Lohn: tiefster Satz der sinkenden Skala.')
      : r(MIN_SATZ, MINDESTBEITRAG, 'Unter Fr. 10 100: Mindestbeitrag.')
  }
  const satz = [...SKALA_2026].reverse().find(([ab]) => einkommen >= ab)![1]
  return r(satz, einkommen * satz / 100, satz < 10 ? 'Sinkende Beitragsskala.' : 'Voller Satz.')
}

export type ReserveEstimate = {
  gewinn: number
  ahv: AhvEstimate
  /** Einkommenssteuer auf dem Gewinn nach Abzug der AHV-Beiträge */
  steuer: number
  grenzsteuersatz: number
  total: number
}

export function estimateReserve(gewinn: number, jahr: number, grenzsteuersatz: number, angestellt = true): ReserveEstimate {
  const ahv = ahvBeitrag(gewinn, jahr, angestellt)
  const steuerbar = Math.max(0, gewinn - ahv.beitrag - ahv.verwaltungskosten)
  const steuer = round2(steuerbar * grenzsteuersatz / 100)
  return { gewinn: round2(gewinn), ahv, steuer, grenzsteuersatz, total: round2(ahv.beitrag + ahv.verwaltungskosten + steuer) }
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
