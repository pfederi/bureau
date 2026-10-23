/**
 * Eingabe eines Zahlenfelds auf Dezimalpunkt bringen: Komma wird Punkt, Leerzeichen,
 * Apostrophe und Buchstaben fallen weg, nur ein Punkt und ein führendes Minus bleiben.
 */
export function normalizeDecimal(raw: string): string {
  const s = raw.replace(/,/g, '.').replace(/[^0-9.-]/g, '')
  const minus = s.startsWith('-') ? '-' : ''
  const [int, ...rest] = s.replace(/-/g, '').split('.')
  return minus + int + (rest.length ? '.' + rest.join('') : '')
}
