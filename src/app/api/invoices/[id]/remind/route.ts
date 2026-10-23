import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth'
import { getInvoiceWithItems, setInvoiceReminded } from '@/lib/db/invoices'
import { getSettings } from '@/lib/db/settings'
import { renderInvoicePdf } from '@/lib/pdf/invoicePdf'
import { buildReminderEmail, sendMail, senderFor } from '@/lib/email/sendInvoice'
import { invoiceFileBase } from '@/lib/pdf/disposition'

/** Zahlungserinnerung mit der Rechnung im Anhang; merkt sich das Datum. */
export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  await requireSession()
  const [{ invoice, items, customer }, settings] = await Promise.all([
    getInvoiceWithItems(params.id), getSettings(),
  ])
  if (invoice.status !== 'versendet') {
    return NextResponse.json({ error: 'Erinnern geht nur bei versendeten, offenen Rechnungen.' }, { status: 400 })
  }
  if (!customer.email) {
    return NextResponse.json({ error: 'Kunde hat keine E-Mail-Adresse.' }, { status: 400 })
  }
  const pdf = await renderInvoicePdf({ invoice, items, customer, settings })
  try {
    await sendMail(buildReminderEmail({
      ...senderFor(settings),
      toEmail: customer.email,
      rechnungsnummer: invoice.rechnungsnummer,
      rechnungsdatum: invoice.rechnungsdatum,
      betrag: Number(invoice.betrag),
      fileBase: invoiceFileBase(invoice.rechnungsnummer, customer.firma_oder_name),
      pdf,
    }))
  } catch (e: any) {
    return NextResponse.json({ error: `Versand fehlgeschlagen: ${e.message}` }, { status: 502 })
  }
  await setInvoiceReminded(params.id)
  return NextResponse.json({ ok: true })
}
