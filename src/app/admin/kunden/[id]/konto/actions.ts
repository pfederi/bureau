'use server'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { createServerSupabase } from '@/lib/supabase/server'
import { newPortalToken } from '@/lib/portal/token'
import { buildCustomerTimeReport, recordSentTimeReport } from '@/lib/db/timeReport'
import { buildTimeReportEmail, sendMail, senderFor } from '@/lib/email/sendInvoice'
import { timeReportFileBase } from '@/lib/timeEntries/report'
import { formatStunden } from '@/lib/invoices/stats'
import { normalizeSiteUrl, type MonitoredSite } from '@/lib/monitoring/sites'
import { runSiteChecks } from '@/lib/monitoring/run'
import { listSites } from '@/lib/db/sites'

type Result = { ok: boolean; error?: string }

/** Kundenlink erstellen bzw. erneuern (der alte Link gilt danach nicht mehr). */
export async function createPortalLinkAction(customerId: string): Promise<Result & { token?: string }> {
  await requireSession()
  const token = newPortalToken()
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('customers')
    .update({ portal_token: token, portal_erstellt_am: new Date().toISOString() }).eq('id', customerId)
  if (error) return { ok: false, error: 'Kundenlink konnte nicht erstellt werden.' }
  revalidatePath('/admin', 'layout')
  return { ok: true, token }
}

/** Kundenlink deaktivieren: die Seite ist danach nicht mehr erreichbar. */
export async function revokePortalLinkAction(customerId: string): Promise<Result> {
  await requireSession()
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('customers')
    .update({ portal_token: null, portal_erstellt_am: null }).eq('id', customerId)
  if (error) return { ok: false, error: 'Kundenlink konnte nicht deaktiviert werden.' }
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

/** Stundenrapport eines Monats an den Kunden senden – nur auf Knopfdruck. */
export async function sendTimeReportAction(customerId: string, monat: string): Promise<Result> {
  await requireSession()
  try {
    const r = await buildCustomerTimeReport(customerId, monat)
    if (!r) return { ok: false, error: 'Keine Einträge in diesem Monat.' }
    if (!r.customer.email) return { ok: false, error: 'Beim Kunden ist keine E-Mail-Adresse erfasst.' }
    const sender = senderFor(r.settings)
    await sendMail(buildTimeReportEmail({
      ...sender,
      toEmail: r.customer.email,
      fileBase: timeReportFileBase(monat, r.customer.firma_oder_name),
      pdf: r.pdf,
      monatLabel: r.report.label,
      stunden: formatStunden(r.report.total),
    }))
    await recordSentTimeReport({ customer_id: customerId, monat, an: r.customer.email, stunden: r.report.total })
  } catch (e: any) {
    return { ok: false, error: `Senden fehlgeschlagen: ${e?.message ?? 'unbekannter Fehler'}` }
  }
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

/** Website zur Überwachung hinzufügen und gleich prüfen. */
export async function addSiteAction(customerId: string, input: string): Promise<Result> {
  await requireSession()
  const url = normalizeSiteUrl(input)
  if (!url) return { ok: false, error: 'Bitte eine gültige Adresse eingeben, z. B. kunde.ch.' }
  const supabase = await createServerSupabase()
  const { data, error } = await supabase.from('monitored_sites').insert({ customer_id: customerId, url }).select('*').single()
  if (error) return { ok: false, error: error.code === '23505' ? 'Diese Website wird schon überwacht.' : 'Website konnte nicht gespeichert werden.' }
  try { await runSiteChecks(supabase, [data as MonitoredSite], new Date(), true) } catch { /* Prüfung folgt mit der nächsten Runde */ }
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

export async function removeSiteAction(id: string): Promise<Result> {
  await requireSession()
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('monitored_sites').delete().eq('id', id)
  if (error) return { ok: false, error: 'Website konnte nicht entfernt werden.' }
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

/** Alle Websites des Kunden jetzt prüfen, inkl. SSL und Domain (ohne Mail). */
export async function checkSitesAction(customerId: string): Promise<Result> {
  await requireSession()
  const supabase = await createServerSupabase()
  try {
    await runSiteChecks(supabase, await listSites(customerId), new Date(), true)
  } catch {
    return { ok: false, error: 'Prüfung fehlgeschlagen.' }
  }
  revalidatePath('/admin', 'layout')
  return { ok: true }
}
