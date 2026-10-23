import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth'
import { getQuoteWithItems, setQuoteStatus } from '@/lib/db/quotes'
import { getSettings } from '@/lib/db/settings'
import { renderQuotePdf } from '@/lib/pdf/invoicePdf'
import { buildQuoteEmail, sendMail, senderFor } from '@/lib/email/sendInvoice'
import { invoiceFileBase } from '@/lib/pdf/disposition'

export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  await requireSession()
  const [{ quote, items, customer }, settings] = await Promise.all([getQuoteWithItems(params.id), getSettings()])
  if (!customer.email) {
    return NextResponse.json({ error: 'Kunde hat keine E-Mail-Adresse.' }, { status: 400 })
  }
  const pdf = await renderQuotePdf({ quote, items, customer, settings })
  try {
    await sendMail(buildQuoteEmail({
      ...senderFor(settings),
      toEmail: customer.email,
      offertnummer: quote.offertnummer,
      gueltigBis: quote.gueltig_bis,
      fileBase: invoiceFileBase(quote.offertnummer, customer.firma_oder_name),
      pdf,
    }))
  } catch (e: any) {
    return NextResponse.json({ error: `Versand fehlgeschlagen: ${e.message}` }, { status: 502 })
  }
  // Angenommene/abgelehnte Offerten behalten ihren Status beim erneuten Senden.
  if (quote.status === 'entwurf') await setQuoteStatus(params.id, 'versendet', { sent_at: new Date().toISOString() })
  return NextResponse.json({ ok: true })
}
