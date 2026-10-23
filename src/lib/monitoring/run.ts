import type { SupabaseClient } from '@supabase/supabase-js'
import { checkSite } from './check'
import { applyCheck, needsDailyCheck, type MonitoredSite, type SiteEvent } from './sites'

export type SiteEventInfo = { site: MonitoredSite; ereignis: SiteEvent; fehler: string | null }

/**
 * Prüft die Seiten parallel und speichert das Ergebnis. `voll`: SSL und Domain auch dann
 * prüfen, wenn heute schon geprüft (Knopf «Jetzt prüfen»).
 */
export async function runSiteChecks(db: SupabaseClient, sites: MonitoredSite[], now: Date, voll = false): Promise<SiteEventInfo[]> {
  const events: SiteEventInfo[] = []
  await Promise.all(sites.map(async site => {
    const r = await checkSite(site.url, voll || needsDailyCheck(site, now))
    const { update, ereignis } = applyCheck(site, r, now)
    const { error } = await db.from('monitored_sites').update(update).eq('id', site.id)
    if (error) throw error
    if (ereignis) events.push({ site: { ...site, ...update }, ereignis, fehler: r.fehler })
  }))
  return events
}
