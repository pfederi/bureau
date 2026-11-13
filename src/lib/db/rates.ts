import { createServerSupabase } from '@/lib/supabase/server'
import type { ProjectRate } from '@/lib/types'
import { ansaetzeAus, betroffeneOffene, projektSchluessel, vorgeschlagenerAnsatz, type OffeneFrage } from '@/lib/timeEntries/rates'
import { getCustomer } from '@/lib/db/customers'
import { getSettings } from '@/lib/db/settings'
import { openEntriesForCustomer } from '@/lib/db/timeEntries'

export async function listProjectRates(customerId?: string): Promise<ProjectRate[]> {
  const supabase = await createServerSupabase()
  let q = supabase.from('project_rates').select('id, customer_id, projekt, stundensatz').order('projekt')
  if (customerId) q = q.eq('customer_id', customerId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(r => ({ ...r, stundensatz: Number(r.stundensatz) })) as ProjectRate[]
}

async function findRate(customerId: string, projekt: string): Promise<ProjectRate | null> {
  const key = projektSchluessel(projekt)
  return (await listProjectRates(customerId)).find(r => projektSchluessel(r.projekt) === key) ?? null
}

/** Legt den Projekt-Ansatz an oder ändert ihn (Projektname wie gespeichert, Vergleich ohne Gross-/Kleinschreibung). */
export async function setProjectRate(customerId: string, projekt: string, stundensatz: number): Promise<void> {
  const supabase = await createServerSupabase()
  const vorhanden = await findRate(customerId, projekt)
  const { error } = vorhanden
    ? await supabase.from('project_rates').update({ stundensatz }).eq('id', vorhanden.id)
    : await supabase.from('project_rates').insert({ customer_id: customerId, projekt: projekt.trim(), stundensatz })
  if (error) throw error
}

export async function deleteProjectRate(customerId: string, projekt: string): Promise<void> {
  const vorhanden = await findRate(customerId, projekt)
  if (!vorhanden) return
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('project_rates').delete().eq('id', vorhanden.id)
  if (error) throw error
}

/** Setzt den Satz offener Einträge (verrechnete bleiben unangetastet). */
export async function setOpenEntryRates(ids: string[], stundensatz: number): Promise<number> {
  if (ids.length === 0) return 0
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('time_entries').update({ stundensatz }).in('id', ids).eq('billed', false).select('id')
  if (error) throw error
  return data?.length ?? 0
}

/** Aktueller Ansatz für Kunde (projekt = null) bzw. Projekt, aus der Datenbank. */
export async function aktuellerAnsatz(customerId: string, projekt: string | null): Promise<number> {
  const [customer, settings, projekte] = await Promise.all([getCustomer(customerId), getSettings(), listProjectRates(customerId)])
  const a = ansaetzeAus(settings.standard_stundensatz, customer ? [customer] : [], projekte)
  return vorgeschlagenerAnsatz(a, customerId, projekt).ansatz
}

/** Betroffene offene Einträge nach einer Änderung von `alt`; null, wenn sich nichts ändert oder keine betroffen sind. */
export async function offeneFrage(customerId: string, projekt: string | null, alt: number): Promise<OffeneFrage | null> {
  const [neu, projekte, offene] = await Promise.all([aktuellerAnsatz(customerId, projekt), listProjectRates(customerId), openEntriesForCustomer(customerId)])
  if (Math.round(neu * 100) === Math.round(alt * 100)) return null
  const anzahl = betroffeneOffene(offene, { customerId, projekt, alterAnsatz: alt, projekte }).length
  return anzahl > 0 ? { customerId, projekt, alt, neu, anzahl } : null
}
