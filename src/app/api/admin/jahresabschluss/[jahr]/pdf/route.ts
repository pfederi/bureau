import { type NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { getSettings } from '@/lib/db/settings'
import { loadYearReport } from '@/lib/db/yearReport'
import { renderYearReportPdf } from '@/lib/pdf/yearReportPdf'
import { pdfContentDisposition } from '@/lib/pdf/disposition'

export async function GET(req: NextRequest, props: { params: Promise<{ jahr: string }> }) {
  const params = await props.params
  await requireSession()
  const jahr = Number(params.jahr)
  if (!Number.isInteger(jahr) || jahr < 2000 || jahr > 2100) return NextResponse.json({ error: 'Ungültiges Jahr.' }, { status: 400 })
  const [{ report, vorjahr }, settings] = await Promise.all([loadYearReport(jahr), getSettings()])
  const pdf = await renderYearReportPdf(report, vorjahr, settings)
  return new Response(pdf as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': pdfContentDisposition(`Jahresabschluss-${jahr}`, req.nextUrl.searchParams.get('inline') === '1'),
      'Cache-Control': 'no-store',
    },
  })
}
