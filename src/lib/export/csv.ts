/**
 * CSV-Zelle für Excel (Semikolon-getrennt). Text, der mit = + @ oder Tab beginnt, würde
 * Excel als Formel ausführen (CSV-Injection, z. B. aus einem ausgelesenen Beleg) –
 * darum mit ' davor. Nur reine negative Zahlen («-12.50») bleiben unverändert – «-1+HYPERLINK(…)» nicht.
 */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  if (/^[=+@\t\r]/.test(s) || (s.startsWith('-') && !/^-\d+(\.\d+)?$/.test(s))) s = `'${s}`
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
