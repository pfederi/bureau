import { siteHost } from '@/lib/monitoring/sites'
import type { SiteEventInfo } from '@/lib/monitoring/run'
import { ABSENDER } from './weekly'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Meldung an dich, wenn eine Kundenseite ausfällt oder wieder erreichbar ist. */
export function buildSiteAlertEmail(events: SiteEventInfo[], kunden: Map<string, string>, baseUrl: string) {
  const down = events.filter(e => e.ereignis === 'down')
  const zeile = (e: SiteEventInfo) => {
    const kunde = kunden.get(e.site.customer_id) ?? ''
    return e.ereignis === 'down'
      ? `${siteHost(e.site.url)} (${kunde}) ist nicht erreichbar${e.fehler ? `: ${e.fehler}` : ''}`
      : `${siteHost(e.site.url)} (${kunde}) ist wieder erreichbar`
  }
  const subject = down.length
    ? `${ABSENDER}: ${down.length === 1 ? `${siteHost(down[0].site.url)} nicht erreichbar` : `${down.length} Websites nicht erreichbar`}`
    : `${ABSENDER}: ${events.length === 1 ? `${siteHost(events[0].site.url)} wieder erreichbar` : 'Websites wieder erreichbar'}`
  const links = Array.from(new Set(events.map(e => e.site.customer_id)))
  const html = [
    `<p style="font:14px/1.5 sans-serif">${events.map(e => `${e.ereignis === 'down' ? '🔴' : '🟢'} ${esc(zeile(e))}`).join('<br>')}</p>`,
    `<p style="font:14px/1.5 sans-serif">${links.map(id => `<a href="${esc(`${baseUrl}/admin/kunden/${id}/konto#websites`)}">${esc(kunden.get(id) ?? 'Kunde')} im Admin öffnen</a>`).join('<br>')}</p>`,
    `<p style="font:12px/1.5 sans-serif;color:#666">Automatische Meldung der Website-Überwachung aus deinem ${ABSENDER}-Admin.</p>`,
  ].join('')
  const text = [...events.map(zeile), '', ...links.map(id => `${baseUrl}/admin/kunden/${id}/konto#websites`)].join('\n')
  return { subject, html, text }
}
