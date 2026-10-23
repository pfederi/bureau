import { type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth'
import { getQuoteWithItems } from '@/lib/db/quotes'
import { getSettings } from '@/lib/db/settings'
import { renderQuotePdf } from '@/lib/pdf/invoicePdf'
import { pdfContentDisposition, invoiceFileBase } from '@/lib/pdf/disposition'

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  await requireSession()
  const inline = req.nextUrl.searchParams.get('inline') === '1'
  const [{ quote, items, customer }, settings] = await Promise.all([getQuoteWithItems(params.id), getSettings()])
  const pdf = await renderQuotePdf({ quote, items, customer, settings })
  return new Response(pdf as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': pdfContentDisposition(invoiceFileBase(quote.offertnummer, customer.firma_oder_name), inline),
      'Cache-Control': 'no-store',
    },
  })
}
