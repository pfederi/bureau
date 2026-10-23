import { type NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { loadYearReport } from '@/lib/db/yearReport'
import { yearReportCsv } from '@/lib/expenses/report'
import { categoryLabel } from '@/lib/expenses/categories'

export async function GET(_req: NextRequest, props: { params: Promise<{ jahr: string }> }) {
  const params = await props.params
  await requireSession()
  const jahr = Number(params.jahr)
  if (!Number.isInteger(jahr) || jahr < 2000 || jahr > 2100) return NextResponse.json({ error: 'Ungültiges Jahr.' }, { status: 400 })
  const { report } = await loadYearReport(jahr)
  return new Response(yearReportCsv(report, categoryLabel), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="Jahresabschluss-${jahr}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
