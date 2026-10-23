import { type NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { cronAuthorized } from '@/lib/cron/auth'
import { appUrl } from '@/lib/appUrl'
import { runSiteChecks } from '@/lib/monitoring/run'
import type { MonitoredSite } from '@/lib/monitoring/sites'
import { buildSiteAlertEmail } from '@/lib/email/siteAlert'
import { weeklyFrom } from '@/lib/email/weekly'
import { MAIL_DEAKTIVIERT, mailConfigured, sendMail, senderFor } from '@/lib/email/sendInvoice'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Website-Überwachung (geplante Aufgabe in Coolify, z. B. alle 15 Minuten): prüft alle
 * Kundenseiten und meldet per Mail, wenn eine ausfällt oder wieder erreichbar ist.
 */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET ist nicht gesetzt.' }, { status: 503 })
  if (!cronAuthorized(req.headers.get('authorization'))) return NextResponse.json({ error: 'Nicht berechtigt.' }, { status: 401 })

  const db = createAdminSupabase()
  const [si, cu, se] = await Promise.all([
    db.from('monitored_sites').select('*'),
    db.from('customers').select('id, firma_oder_name'),
    db.from('settings').select('*').eq('id', 1).single(),
  ])
  const fehler = [si, cu, se].find(r => r.error)?.error
  if (fehler || !se.data) return NextResponse.json({ error: fehler?.message ?? 'Einstellungen fehlen.' }, { status: 500 })

  const sites = si.data as MonitoredSite[]
  // Prüfen und Zustand speichern läuft immer; die Mail nur mit eingerichtetem Resend
  const events = await runSiteChecks(db, sites, new Date())
  const mailAktiv = mailConfigured()
  if (events.length > 0 && mailAktiv) {
    const kunden = new Map((cu.data as { id: string; firma_oder_name: string }[]).map(c => [c.id, c.firma_oder_name]))
    const mail = buildSiteAlertEmail(events, kunden, appUrl())
    try {
      await sendMail({ from: weeklyFrom(senderFor(se.data).fromEmail), to: se.data.absender_email, subject: mail.subject, html: mail.html, text: mail.text, attachments: [] })
    } catch (e: any) {
      return NextResponse.json({ error: `Mail fehlgeschlagen: ${e?.message}`, geprueft: sites.length, ereignisse: events.length }, { status: 502 })
    }
  }
  return NextResponse.json({
    ok: true,
    ...(mailAktiv ? {} : { hinweis: MAIL_DEAKTIVIERT }),
    geprueft: sites.length,
    ereignisse: events.map(e => ({ url: e.site.url, ereignis: e.ereignis })),
  })
}
