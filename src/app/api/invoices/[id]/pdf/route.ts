import { type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth'
import { getInvoiceWithItems } from '@/lib/db/invoices'
import { getSettings } from '@/lib/db/settings'
import { renderInvoicePdf } from '@/lib/pdf/invoicePdf'
import { pdfContentDisposition, invoiceFileBase } from '@/lib/pdf/disposition'

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  await requireSession()
  const inline = req.nextUrl.searchParams.get('inline') === '1'
  const [{ invoice, items, customer }, settings] = await Promise.all([
    getInvoiceWithItems(params.id), getSettings(),
  ])
  const pdf = await renderInvoicePdf({ invoice, items, customer, settings })
  return new Response(pdf as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': pdfContentDisposition(invoiceFileBase(invoice.rechnungsnummer, customer.firma_oder_name), inline),
      'Cache-Control': 'no-store',
    },
  })
}
