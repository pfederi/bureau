import { formatChf } from '@/lib/invoices/stats'
import { ABSENDER } from './weekly'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Meldung an dich, wenn ein Kunde im Kundenlink eine Offerte annimmt oder ablehnt. */
export function buildQuoteAnswerEmail(
  i: { kunde: string; customerId: string; offertnummer: string; betrag: number; antwort: 'annehmen' | 'ablehnen'; name: string; grund: string | null },
  baseUrl: string,
) {
  const verb = i.antwort === 'annehmen' ? 'angenommen' : 'abgelehnt'
  const subject = `${i.kunde} hat Offerte ${i.offertnummer} ${verb}`
  const link = `${baseUrl}/admin/offerten?kunde=${encodeURIComponent(i.customerId)}&jahr=alle`
  const zeilen = [
    `${i.kunde} hat die Offerte ${i.offertnummer} über ${formatChf(i.betrag)} im Kundenlink ${verb}.`,
    `Name: ${i.name}`,
    ...(i.grund ? [`Grund: ${i.grund}`] : []),
  ]
  const html = [
    `<p style="font:14px/1.5 sans-serif">${zeilen.map(z => esc(z).replace(/\n/g, '<br>')).join('<br>')}</p>`,
    `<p style="font:14px/1.5 sans-serif"><a href="${esc(link)}">Offerte im Admin öffnen</a>${i.antwort === 'annehmen' ? ' – dort «In Rechnung umwandeln».' : ''}</p>`,
    `<p style="font:12px/1.5 sans-serif;color:#666">Automatische Meldung aus deinem ${esc(ABSENDER)}-Admin.</p>`,
  ].join('')
  return { subject, html, text: [...zeilen, '', link].join('\n') }
}
