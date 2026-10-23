import type { Customer, Invoice, Quote, TimeEntry } from '@/lib/types'
import { hostingItemForYear, FIRST_HOSTING_YEAR } from '@/lib/invoices/hosting'
import { computeItemTotal } from '@/lib/invoices/calc'
import type { MissingRecurring } from '@/lib/expenses/recurring'
import { ZAHLUNGSFRIST_TAGE, formatStunden } from '@/lib/invoices/stats'
import { budgetUsage } from '@/lib/invoices/budget'
import { siteProblems, type MonitoredSite } from '@/lib/monitoring/sites'
import { formatDatum } from '@/lib/utils'

/**
 * „Todos“ im Dashboard: was liegen geblieben ist und eine Handlung braucht.
 * Dringend (zuerst): überfällige Rechnungen, abgelaufene Offerten.
 */

export type TodoArt = 'erinnern' | 'offerte' | 'entwurf' | 'stunden' | 'beleg' | 'hosting' | 'budget' | 'website'

export type Todo = {
  key: string
  art: TodoArt
  titel: string
  detail: string
  href: string
  dringend: boolean
  /** Sortierung innerhalb der Dringlichkeit: Tage seit Fälligkeit/Beginn, grösste zuerst */
  tage: number
  /** Nur bei „erinnern“: Rechnung, an die erinnert werden kann (Kunde hat E-Mail) */
  erinnern?: { invoiceId: string; rechnungsnummer: string; email: string }
  betrag?: number
}

type Kunde = { customer?: { firma_oder_name: string; email?: string | null } | null }
type TodoInvoice = Pick<Invoice, 'id' | 'rechnungsnummer' | 'status' | 'rechnungsdatum' | 'betrag' | 'sent_at' | 'erinnert_am' | 'verrechnung_material' | 'customer_id'> & Partial<Pick<Invoice, 'hosting_jahr'>> & Kunde
type TodoCustomer = Pick<Customer, 'id' | 'firma_oder_name' | 'hosting_text' | 'hosting_preis_monat' | 'hosting_ab' | 'hosting_bis'>
  & Partial<Pick<Customer, 'stunden_budget' | 'budget_zeitraum'>>
type TodoQuote = Pick<Quote, 'id' | 'offertnummer' | 'status' | 'offertdatum' | 'gueltig_bis' | 'betrag' | 'customer_id'> & Kunde
type TodoEntry = Pick<TimeEntry, 'customer_id' | 'datum' | 'stunden' | 'stundensatz' | 'billed'> & Kunde

/** Erst nach so vielen Tagen erneut an dieselbe Rechnung erinnern */
export const ERINNERUNG_ABSTAND_TAGE = 14
export const ENTWURF_ALT_TAGE = 7
export const OFFERTE_VORLAUF_TAGE = 7
export const STUNDEN_ALT_TAGE = 30

const DAY = 86_400_000
const tageSeit = (iso: string, now: Date) => Math.floor((now.getTime() - Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso)) / DAY)
const kunde = (x: Kunde) => x.customer?.firma_oder_name ?? 'Unbekannt'
const round2 = (n: number) => Math.round(n * 100) / 100

export function computeTodos(input: {
  invoices: TodoInvoice[]
  quotes: TodoQuote[]
  timeEntries: TodoEntry[]
  fehlendeBelege: MissingRecurring[]
  customers?: TodoCustomer[]
  /** Überwachte Websites (Ausfall, SSL, Domain) */
  sites?: MonitoredSite[]
  now: Date
}): Todo[] {
  const { now } = input
  const todos: Todo[] = []

  // Überfällige Rechnungen (Material-Verrechnung wird nicht gemahnt, die läuft übers Kundenkonto)
  for (const i of input.invoices) {
    if (i.status !== 'versendet' || i.verrechnung_material) continue
    const offen = tageSeit(i.sent_at ?? i.rechnungsdatum, now)
    if (offen <= ZAHLUNGSFRIST_TAGE) continue
    const seitErinnerung = i.erinnert_am ? tageSeit(i.erinnert_am, now) : null
    const email = i.customer?.email
    todos.push({
      key: `rechnung-${i.id}`,
      art: 'erinnern',
      titel: `${i.rechnungsnummer} · ${kunde(i)}`,
      detail: `${offen} Tage offen` + (seitErinnerung !== null ? ` · erinnert vor ${seitErinnerung} ${seitErinnerung === 1 ? 'Tag' : 'Tagen'}` : ''),
      href: `/admin/rechnungen?kunde=${i.customer_id}&status=versendet&jahr=alle`,
      dringend: true,
      tage: offen - ZAHLUNGSFRIST_TAGE,
      betrag: Number(i.betrag),
      erinnern: email && (seitErinnerung === null || seitErinnerung >= ERINNERUNG_ABSTAND_TAGE)
        ? { invoiceId: i.id, rechnungsnummer: i.rechnungsnummer, email }
        : undefined,
    })
  }

  // Offerten: abgelaufen (dringend) oder bald ablaufend
  for (const q of input.quotes) {
    if (q.status !== 'versendet' || !q.gueltig_bis) continue
    const bis = tageSeit(q.gueltig_bis, now) // > 0: abgelaufen seit, ≤ 0: noch gültig
    if (bis < -OFFERTE_VORLAUF_TAGE) continue
    todos.push({
      key: `offerte-${q.id}`,
      art: 'offerte',
      titel: `${q.offertnummer} · ${kunde(q)}`,
      detail: bis > 0 ? `abgelaufen seit ${bis} ${bis === 1 ? 'Tag' : 'Tagen'} – nachfragen oder als abgelehnt markieren`
        : bis === 0 ? 'läuft heute ab' : `läuft in ${-bis} ${bis === -1 ? 'Tag' : 'Tagen'} ab`,
      href: '/admin/offerten?status=versendet&jahr=alle',
      dringend: bis > 0,
      tage: bis,
      betrag: Number(q.betrag),
    })
  }

  // Liegengebliebene Entwürfe
  for (const i of input.invoices) {
    if (i.status !== 'entwurf') continue
    const alt = tageSeit(i.rechnungsdatum, now)
    if (alt < ENTWURF_ALT_TAGE) continue
    todos.push({
      key: `entwurf-${i.id}`, art: 'entwurf', titel: `Rechnungsentwurf ${i.rechnungsnummer} · ${kunde(i)}`,
      detail: `seit ${alt} Tagen nicht versendet`, href: '/admin/rechnungen?status=entwurf&jahr=alle', dringend: false, tage: alt,
      betrag: Number(i.betrag),
    })
  }
  for (const q of input.quotes) {
    if (q.status !== 'entwurf') continue
    const alt = tageSeit(q.offertdatum, now)
    if (alt < ENTWURF_ALT_TAGE) continue
    todos.push({
      key: `offertentwurf-${q.id}`, art: 'entwurf', titel: `Offertentwurf ${q.offertnummer} · ${kunde(q)}`,
      detail: `seit ${alt} Tagen nicht versendet`, href: '/admin/offerten?status=entwurf&jahr=alle', dringend: false, tage: alt,
      betrag: Number(q.betrag),
    })
  }

  // Stunden, die seit über einem Monat auf die Rechnung warten (pro Kunde)
  const proKunde = new Map<string, { kunde: string; stunden: number; wert: number; aeltestes: string }>()
  for (const e of input.timeEntries) {
    if (e.billed) continue
    const r = proKunde.get(e.customer_id) ?? { kunde: kunde(e), stunden: 0, wert: 0, aeltestes: e.datum }
    r.stunden += Number(e.stunden)
    r.wert += Number(e.stunden) * Number(e.stundensatz)
    if (e.datum < r.aeltestes) r.aeltestes = e.datum
    proKunde.set(e.customer_id, r)
  }
  for (const [customerId, r] of Array.from(proKunde.entries())) {
    const alt = tageSeit(r.aeltestes, now)
    if (alt <= STUNDEN_ALT_TAGE) continue
    todos.push({
      key: `stunden-${customerId}`, art: 'stunden', titel: `${round2(r.stunden)} Std. nicht verrechnet · ${r.kunde}`,
      detail: `ältester Eintrag vor ${alt} Tagen`, href: `/admin/rechnungen/neu?kunde=${customerId}`, dringend: false, tage: alt,
      betrag: round2(r.wert),
    })
  }

  // Fehlende Belege wiederkehrender Ausgaben
  for (const m of input.fehlendeBelege) {
    const alt = tageSeit(m.erwartet, now)
    todos.push({
      key: `beleg-${m.key}`, art: 'beleg', titel: `Beleg fehlt: ${m.beschreibung}`,
      detail: `${m.frequenz === 'monatlich' ? 'monatlich' : 'jährlich'}, erwartet seit ${alt} Tagen`, href: '/admin/ausgaben', dringend: false, tage: alt,
    })
  }

  // Hosting: Vorjahr (dringend, falls noch offen) und laufendes Jahr
  const jahr = now.getUTCFullYear()
  for (const j of [jahr - 1, jahr].filter(y => y >= FIRST_HOSTING_YEAR)) {
    const fehlen = (input.customers ?? []).flatMap(c => {
      const item = hostingItemForYear(c, j)
      const verrechnet = input.invoices.some(i => i.customer_id === c.id && Number(i.hosting_jahr) === j && i.status !== 'storniert')
      return item && !verrechnet ? [{ name: c.firma_oder_name, betrag: computeItemTotal(item.menge, item.einzelpreis) }] : []
    })
    if (fehlen.length === 0) continue
    todos.push({
      key: `hosting-${j}`, art: 'hosting', titel: `Hosting ${j} noch nicht verrechnet`,
      detail: fehlen.map(f => f.name).join(', '), href: `/admin/rechnungen?hosting=${j}`,
      dringend: j < jahr, tage: j < jahr ? 365 : 0, betrag: round2(fehlen.reduce((s, f) => s + f.betrag, 0)),
    })
  }

  // Stundenbudget ab 80 % (dringend, wenn überschritten)
  for (const c of input.customers ?? []) {
    const u = budgetUsage({ id: c.id, stunden_budget: c.stunden_budget ?? null, budget_zeitraum: c.budget_zeitraum ?? null }, input.timeEntries, now)
    if (!u || u.stufe === 'ok') continue
    const prozent = Math.round((u.verbraucht / u.budget) * 100)
    todos.push({
      key: `budget-${c.id}`, art: 'budget', titel: `Stundenbudget ${prozent} % · ${c.firma_oder_name}`,
      detail: `${formatStunden(u.verbraucht)} von ${formatStunden(u.budget)} Std. (${u.label})${u.stufe === 'ueberschritten' ? ' – überschritten' : ''}`,
      href: `/admin/kunden/${c.id}/konto`, dringend: u.stufe === 'ueberschritten', tage: prozent,
    })
  }

  // Websites: Ausfall, Zertifikat oder Domain läuft ab
  const kundenName = new Map((input.customers ?? []).map(c => [c.id, c.firma_oder_name]))
  for (const p of siteProblems((input.sites ?? []).map(s => ({ ...s, kunde: kundenName.get(s.customer_id) ?? 'Unbekannt' })), now, formatDatum)) {
    todos.push({ key: p.key, art: 'website', titel: p.titel, detail: p.detail, href: `/admin/kunden/${p.customerId}/konto#websites`, dringend: p.dringend, tage: p.tage })
  }

  return todos.sort((a, b) => Number(b.dringend) - Number(a.dringend) || b.tage - a.tage)
}
