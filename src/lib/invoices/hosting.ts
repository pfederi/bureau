import type { Customer } from '@/lib/types'

const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

type HostingConfig = Pick<Customer, 'hosting_text' | 'hosting_preis_monat' | 'hosting_ab' | 'hosting_bis'>

/** Hosting wird erst ab diesem Jahr verrechnet; frühere Jahre gelten als abgegolten (keine Position, keine Meldung). */
export const FIRST_HOSTING_YEAR = 2026

/** Jahre für die Hosting-Auswahl: nächstes Jahr bis FIRST_HOSTING_YEAR, absteigend. */
export function hostingYears(now = new Date()): string[] {
  const bis = now.getFullYear() + 1
  return Array.from({ length: Math.max(1, bis - FIRST_HOSTING_YEAR + 1) }, (_, i) => String(bis - i))
}

export function hasHosting(c: HostingConfig): boolean {
  return Number(c.hosting_preis_monat ?? 0) > 0
}

/** Aktive Monate (1–12, inklusiv) im Jahr oder null, wenn im Jahr nicht aktiv. */
export function hostingMonthRange(c: HostingConfig, jahr: number): { von: number; bis: number } | null {
  const [abJahr, abMonat] = c.hosting_ab ? c.hosting_ab.split('-').map(Number) : [jahr, 1]
  const [bisJahr, bisMonat] = c.hosting_bis ? c.hosting_bis.split('-').map(Number) : [jahr, 12]
  const von = abJahr < jahr ? 1 : abJahr > jahr ? 13 : abMonat
  const bis = bisJahr > jahr ? 12 : bisJahr < jahr ? 0 : bisMonat
  return von <= bis ? { von, bis } : null
}

/** Rechnungsposition für das Hosting eines Jahres (anteilig nach aktiven Monaten). */
export function hostingItemForYear(c: HostingConfig, jahr: number) {
  if (!hasHosting(c) || jahr < FIRST_HOSTING_YEAR) return null
  const range = hostingMonthRange(c, jahr)
  if (!range) return null
  const menge = range.bis - range.von + 1
  const zeitraum = menge === 12
    ? ''
    : range.von === range.bis
      ? ` (${MONATE[range.von - 1]})`
      : ` (${MONATE[range.von - 1]}–${MONATE[range.bis - 1]})`
  return {
    bezeichnung: `${c.hosting_text?.trim() || 'Hosting'} ${jahr}${zeitraum}`,
    menge,
    einheit: 'Monat',
    einzelpreis: Number(c.hosting_preis_monat),
  }
}
