import { type NextRequest } from 'next/server'
import { getPortalQuote } from '@/lib/db/portal'
import { renderQuotePdf } from '@/lib/pdf/invoicePdf'
import { pdfContentDisposition, invoiceFileBase } from '@/lib/pdf/disposition'

export const dynamic = 'force-dynamic'

/** Offerten-PDF für die Kundenseite: nur mit gültigem Kundenlink und nur eigene Offerten. */
export async function GET(_req: NextRequest, props: { params: Promise<{ token: string; id: string }> }) {
  const params = await props.params
  const data = await getPortalQuote(params.token, params.id)
  if (!data) return new Response('Nicht gefunden.', { status: 404 })
  const pdf = await renderQuotePdf(data)
  return new Response(pdf as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': pdfContentDisposition(invoiceFileBase(data.quote.offertnummer, data.customer.firma_oder_name), true),
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
      'Referrer-Policy': 'no-referrer',
    },
  })
}
