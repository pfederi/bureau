import { type NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { buildCustomerTimeReport } from '@/lib/db/timeReport'
import { timeReportFileBase } from '@/lib/timeEntries/report'
import { pdfContentDisposition } from '@/lib/pdf/disposition'

export const dynamic = 'force-dynamic'

/** Vorschau des Stundenrapports: /api/admin/kunden/[id]/rapport?monat=2026-09 */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  await requireSession()
  const monat = req.nextUrl.searchParams.get('monat') ?? ''
  const r = await buildCustomerTimeReport(params.id, monat)
  if (!r) return NextResponse.json({ error: 'Keine Einträge in diesem Monat.' }, { status: 404 })
  return new Response(r.pdf as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': pdfContentDisposition(timeReportFileBase(monat, r.customer.firma_oder_name), req.nextUrl.searchParams.get('inline') === '1'),
      'Cache-Control': 'no-store',
    },
  })
}
