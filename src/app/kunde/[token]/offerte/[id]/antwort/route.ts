import { after, type NextRequest, NextResponse } from 'next/server'
import { answerPortalQuote, getPortalCustomer, portalSettings } from '@/lib/db/portal'
import { antwortSchema, heuteZuerich } from '@/lib/portal/quotes'
import { buildQuoteAnswerEmail } from '@/lib/email/quoteAnswer'
import { mailConfigured, sendMail, senderFor } from '@/lib/email/sendInvoice'
import { weeklyFrom } from '@/lib/email/weekly'
import { appUrl } from '@/lib/appUrl'
import { gleicheHerkunft } from '@/lib/portal/herkunft'

export const dynamic = 'force-dynamic'

const antwort = (body: Record<string, unknown>, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } })

/** Antwort des Kunden auf eine Offerte (annehmen/ablehnen) – öffentlich, nur mit gültigem Kundenlink. */
export async function POST(req: NextRequest, props: { params: Promise<{ token: string; id: string }> }) {
  const params = await props.params
  const customer = await getPortalCustomer(params.token)
  if (!customer) return antwort({ error: 'Nicht gefunden.' }, 404)
  if (!gleicheHerkunft(req.headers.get('origin'), req.headers.get('host'), req.headers.get('x-forwarded-host'))) return antwort({ error: 'Nicht erlaubt.' }, 403)
  const parsed = antwortSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return antwort({ error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }, 400)

  let quote
  try {
    quote = await answerPortalQuote(customer.id, params.id, parsed.data, heuteZuerich())
  } catch (e) {
    console.error('Kundenlink: Antwort auf Offerte nicht gespeichert', e)
    return antwort({ error: 'Das hat leider nicht geklappt. Bitte später nochmals versuchen.' }, 500)
  }
  if (!quote) return antwort({ error: 'Diese Offerte kann nicht mehr beantwortet werden (bereits beantwortet oder abgelaufen).' }, 409)

  // Die Antwort ist gespeichert; die Mail ist nur Benachrichtigung und läuft nach der Antwort an den Kunden
  if (mailConfigured()) {
    const { antwort: art, name, grund } = parsed.data
    after(async () => {
      try {
        const settings = await portalSettings()
        const mail = buildQuoteAnswerEmail({
          kunde: customer.firma_oder_name, customerId: customer.id, offertnummer: quote.offertnummer, betrag: Number(quote.betrag),
          antwort: art, name, grund,
        }, appUrl())
        await sendMail({ from: weeklyFrom(senderFor(settings).fromEmail), to: settings.absender_email, subject: mail.subject, html: mail.html, text: mail.text, attachments: [] })
      } catch (e) {
        console.error('Kundenlink: Mail zur Offerten-Antwort nicht verschickt', e)
      }
    })
  }
  return antwort({ ok: true }, 200)
}
