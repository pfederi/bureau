/** Zeitaufwand pro Version (docs/release-notes/aufwand.json, erzeugt von scripts/aufwand.mjs). */
export type VersionEffort = { version: string; bis: string; minuten: number; sitzungen: number }
export type EffortFile = { versionen: VersionEffort[]; hinweis?: string }

/** «ca. 2 Std. 35 Min.» – auf 5 Minuten gerundet, da geschätzt. */
export function formatDauer(minuten: number): string {
  const m = Math.max(5, Math.round(minuten / 5) * 5)
  const std = Math.floor(m / 60)
  const rest = m % 60
  if (std === 0) return `ca. ${rest} Min.`
  return rest === 0 ? `ca. ${std} Std.` : `ca. ${std} Std. ${rest} Min.`
}

export function effortByVersion(file: EffortFile | null): Map<string, VersionEffort> {
  return new Map((file?.versionen ?? []).map(v => [v.version, v]))
}

export function totalMinutes(file: EffortFile | null): number {
  return (file?.versionen ?? []).reduce((s, v) => s + (v.minuten ?? 0), 0)
}

/** Gegenwert der Arbeitszeit zum Stundensatz, auf ganze Franken gerundet (Schätzung). */
export function effortValue(minuten: number, stundensatz: number): number {
  return Math.round((minuten / 60) * stundensatz)
}
