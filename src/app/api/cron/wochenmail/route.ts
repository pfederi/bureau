import { type NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { cronAuthorized } from '@/lib/cron/auth'
import { appUrl } from '@/lib/appUrl'
import { computeTodos } from '@/lib/dashboard/todos'
import { findMissingRecurring } from '@/lib/expenses/recurring'
import { computeYearReport } from '@/lib/expenses/report'
import { estimateReserve } from '@/lib/expenses/reserve'
import { coveredAmounts } from '@/lib/invoices/account'
import { listCreditsFor } from '@/modules/material'
import { openInvoiceRows, unbilledHoursByCustomer } from '@/lib/invoices/stats'
import { buildWeeklyEmail, weeklyFrom } from '@/lib/email/weekly'
import { MAIL_DEAKTIVIERT, mailConfigured, sendMail, senderFor } from '@/lib/email/sendInvoice'
import { formatDatum } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Wochenmail an die eigene Absender-Adresse. Läuft ohne Anmeldung (Cron), darum mit
 * Service-Key und eigenem Geheimnis. `?vorschau=1` gibt die Mail nur zurück.
 */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET ist nicht gesetzt.' }, { status: 503 })
  if (!cronAuthorized(req.headers.get('authorization'))) return NextResponse.json({ error: 'Nicht berechtigt.' }, { status: 401 })

  const db = createAdminSupabase()
  const [inv, quo, te, ex, cu, cr, se, si] = await Promise.all([
    db.from('invoices').select('*, customer:customers(*)'),
    db.from('quotes').select('*, customer:customers(*)'),
    db.from('time_entries').select('*, customer:customers(firma_oder_name)'),
    db.from('expenses').select('*'),
    db.from('customers').select('*'),
    // wirft bei Fehler – hier in die gleiche Form wie die übrigen Abfragen gebracht
    listCreditsFor(db).then(data => ({ data, error: null }), (error: Error) => ({ data: null, error })),
    db.from('settings').select('*').eq('id', 1).single(),
    db.from('monitored_sites').select('*'),
  ])
  const fehler = [inv, quo, te, ex, cu, cr, se, si].find(r => r.error)?.error
  if (fehler || !se.data) return NextResponse.json({ error: fehler?.message ?? 'Einstellungen fehlen.' }, { status: 500 })

  const now = new Date()
  const jahr = now.getFullYear()
  const invoices = inv.data as any[]
  const gewinn = computeYearReport(invoices, ex.data as any[], jahr).gewinn
  const mail = buildWeeklyEmail({
    // Hinter dem Proxy (Coolify) ist die eigene Adresse localhost – Links immer auf die öffentliche Adresse
    baseUrl: appUrl(),
    datum: formatDatum(now.toISOString().slice(0, 10)),
    jahr,
    todos: computeTodos({
      invoices, quotes: quo.data as any[], timeEntries: te.data as any[], customers: cu.data as any[], sites: si.data as any[],
      fehlendeBelege: findMissingRecurring(ex.data as any[], now, se.data.belege_ausgeblendet ?? []), now,
    }),
    offen: openInvoiceRows(invoices, coveredAmounts(invoices, cr.data as any[]), now),
    unbilled: unbilledHoursByCustomer(te.data as any[]),
    gewinn,
    ruecklage: estimateReserve(gewinn, jahr, Number(se.data.grenzsteuersatz ?? 25)),
  })

  if (req.nextUrl.searchParams.get('vorschau') === '1') {
    return new Response(mail.html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
  }
  // Ohne Resend läuft der Job, verschickt aber nichts (Bureau ohne Mailversand)
  if (!mailConfigured()) return NextResponse.json({ ok: true, hinweis: MAIL_DEAKTIVIERT, betreff: mail.subject })
  const { fromEmail } = senderFor(se.data)
  try {
    await sendMail({ from: weeklyFrom(fromEmail), to: se.data.absender_email, subject: mail.subject, html: mail.html, text: mail.text, attachments: [] })
  } catch (e: any) {
    return NextResponse.json({ error: `Versand fehlgeschlagen: ${e?.message ?? e}` }, { status: 502 })
  }
  return NextResponse.json({ ok: true, an: se.data.absender_email, betreff: mail.subject })
}
