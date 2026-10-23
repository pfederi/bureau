import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth'
import { getInvoiceWithItems, setInvoiceStatus } from '@/lib/db/invoices'
import { getSettings } from '@/lib/db/settings'
import { syncCustomerAccount } from '@/modules/material'
import { renderInvoicePdf } from '@/lib/pdf/invoicePdf'
import { buildInvoiceEmail, sendMail, senderFor } from '@/lib/email/sendInvoice'
import { invoiceFileBase } from '@/lib/pdf/disposition'

export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  await requireSession()
  const [{ invoice, items, customer }, settings] = await Promise.all([
    getInvoiceWithItems(params.id), getSettings(),
  ])
  if (!customer.email) {
    return NextResponse.json({ error: 'Kunde hat keine E-Mail-Adresse.' }, { status: 400 })
  }
  if (invoice.status === 'storniert') {
    return NextResponse.json({ error: 'Stornierte Rechnungen können nicht versendet werden.' }, { status: 400 })
  }
  const pdf = await renderInvoicePdf({ invoice, items, customer, settings })
  try {
    await sendMail(buildInvoiceEmail({
      ...senderFor(settings),
      toEmail: customer.email,
      rechnungsnummer: invoice.rechnungsnummer,
      fileBase: invoiceFileBase(invoice.rechnungsnummer, customer.firma_oder_name),
      pdf,
    }))
  } catch (e: any) {
    return NextResponse.json({ error: `Versand fehlgeschlagen: ${e.message}` }, { status: 502 })
  }
  // Erstes Versanddatum behalten: «Erneut senden» soll die Tage seit Versand nicht zurücksetzen.
  await setInvoiceStatus(params.id, 'versendet', { sent_at: invoice.sent_at ?? new Date().toISOString() })
  // Vorhandenes Guthaben im Kundenkonto deckt die Rechnung evtl. sofort.
  if (invoice.verrechnung_material) await syncCustomerAccount(invoice.customer_id)
  return NextResponse.json({ ok: true })
}
