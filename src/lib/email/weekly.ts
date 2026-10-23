import { formatChf, formatStunden, type OpenInvoiceRow, type UnbilledRow } from '@/lib/invoices/stats'
import { edition } from '@/edition'
import type { Todo } from '@/lib/dashboard/todos'
import type { ReserveEstimate } from '@/lib/expenses/reserve'

/** Wochenmail an sich selbst: Todos, offene Beträge, unverrechnete Stunden, Gewinn und Rücklage. */
export type WeeklyInput = {
  baseUrl: string
  datum: string
  jahr: number
  todos: Todo[]
  offen: OpenInvoiceRow[]
  unbilled: UnbilledRow[]
  gewinn: number
  ruecklage: ReserveEstimate
}

/** Klar erkennbarer Absender in Betreff, Kopf- und Fusszeile */
export const ABSENDER = edition.name
const FUSS = `Automatische Wochenübersicht aus deinem ${edition.adminTitel}, jeden Montag. Abmelden: geplante Aufgabe beim Hosting deaktivieren.`

/** Absendername aus der Edition, Adresse wie beim Rechnungsversand */
export function weeklyFrom(fromEmail: string): string {
  const adresse = fromEmail.match(/<([^>]+)>/)?.[1] ?? fromEmail.trim()
  return `${ABSENDER} <${adresse}>`
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function buildWeeklyEmail(i: WeeklyInput): { subject: string; html: string; text: string } {
  const dringend = i.todos.filter(t => t.dringend).length
  const offenTotal = i.offen.reduce((s, r) => s + r.rest, 0)
  const subject = i.todos.length === 0
    ? `${ABSENDER} · Wochenübersicht ${i.datum}: alles erledigt`
    : `${ABSENDER} · Wochenübersicht ${i.datum}: ${i.todos.length} ${i.todos.length === 1 ? 'Todo' : 'Todos'}${dringend ? `, ${dringend} dringend` : ''}`
  const url = (path: string) => `${i.baseUrl}${path}`

  const todoHtml = i.todos.length === 0
    ? '<p>Keine Todos – nichts überfällig, keine alten Entwürfe oder Stunden.</p>'
    : `<ul>${i.todos.map(t => `<li><a href="${esc(url(t.href))}">${esc(t.titel)}</a>${t.betrag !== undefined ? ` · ${esc(formatChf(t.betrag))}` : ''}<br><small>${t.dringend ? '<strong>Dringend:</strong> ' : ''}${esc(t.detail)}</small></li>`).join('')}</ul>`
  const offenHtml = i.offen.length === 0
    ? '<p>Keine offenen Rechnungen.</p>'
    : `<ul>${i.offen.map(r => `<li>${esc(r.rechnungsnummer)} · ${esc(r.kunde)} · ${esc(formatChf(r.rest))} · ${r.tage} Tage</li>`).join('')}</ul><p>Total offen: <strong>${esc(formatChf(offenTotal))}</strong></p>`
  const stundenHtml = i.unbilled.length === 0
    ? '<p>Alle Stunden verrechnet.</p>'
    : `<ul>${i.unbilled.map(r => `<li>${esc(r.kunde)}: ${formatStunden(r.stunden)} Std. · ${esc(formatChf(r.wert))}</li>`).join('')}</ul>`

  const html = [
    `<p style="margin:0;color:#64748b;font-size:12px;letter-spacing:.05em;text-transform:uppercase">${ABSENDER} · Admin</p>`,
    `<h2 style="margin-top:4px">Wochenübersicht ${esc(i.datum)}</h2>`,
    '<h3>Todos</h3>', todoHtml,
    '<h3>Offene Rechnungen</h3>', offenHtml,
    '<h3>Noch nicht verrechnete Stunden</h3>', stundenHtml,
    `<h3>${i.jahr} bisher</h3>`,
    `<p>Gewinn ${esc(formatChf(i.gewinn))} · Rücklage für AHV und Steuern ca. ${esc(formatChf(i.ruecklage.total))}</p>`,
    `<p><a href="${esc(url('/admin'))}">Zum Dashboard</a></p>`,
    `<hr style="border:none;border-top:1px solid #e2e8f0"><p style="color:#64748b;font-size:12px">${FUSS}</p>`,
  ].join('')

  const text = [
    `${ABSENDER} · Admin`, `Wochenübersicht ${i.datum}`, '',
    'Todos', ...(i.todos.length ? i.todos.map(t => `- ${t.titel}${t.betrag !== undefined ? ` · ${formatChf(t.betrag)}` : ''} (${t.dringend ? 'dringend, ' : ''}${t.detail})`) : ['- keine']), '',
    'Offene Rechnungen', ...(i.offen.length ? i.offen.map(r => `- ${r.rechnungsnummer} · ${r.kunde} · ${formatChf(r.rest)} · ${r.tage} Tage`) : ['- keine']), '',
    'Noch nicht verrechnete Stunden', ...(i.unbilled.length ? i.unbilled.map(r => `- ${r.kunde}: ${formatStunden(r.stunden)} Std. · ${formatChf(r.wert)}`) : ['- keine']), '',
    `${i.jahr} bisher: Gewinn ${formatChf(i.gewinn)}, Rücklage ca. ${formatChf(i.ruecklage.total)}`, '',
    url('/admin'), '', '--', FUSS,
  ].join('\n')

  return { subject, html, text }
}
