import { createServerSupabase } from '@/lib/supabase/server'
import { formatDatum } from '@/lib/utils'
import { formatChf } from '@/lib/invoices/stats'
import { edition, type Edition } from '@/edition'

export type SearchHit = { id: string; group: 'Kunden' | 'Rechnungen' | 'Offerten' | 'Zeiteinträge' | 'Projekte'; title: string; subtitle: string; href: string }

/**
 * Suchbegriff für PostgREST-Filter entschärfen: Komma, Klammern und Wildcards
 * haben in `or=(…)`/`ilike` eine Bedeutung und würden den Filter verändern.
 */
export function sanitizeSearch(q: string): string {
  return q.replace(/[,()*%\\:"']/g, ' ').replace(/\s+/g, ' ').trim()
}

const LIMIT = 5

/** Durchsuchte Tabellen in dieser Reihenfolge (projects nur mit Website; Edition als Parameter für Tests) */
export function searchTables(ed: Edition = edition): string[] {
  return ['customers', 'invoices', 'quotes', 'time_entries', ...(ed.website ? ['projects'] : [])]
}

/** Sucht in Kunden, Rechnungen, Offerten, Zeiteinträgen und Projekten (je höchstens 5 Treffer). */
export async function searchAll(raw: string): Promise<SearchHit[]> {
  const q = sanitizeSearch(raw)
  if (q.length < 2) return []
  const mitProjekten = searchTables().includes('projects')
  const like = `%${q}%`
  const supabase = await createServerSupabase()

  const { data: customers } = await supabase.from('customers')
    .select('id, firma_oder_name, ort, email, kundennummer')
    .or(`firma_oder_name.ilike.${like},ort.ilike.${like},email.ilike.${like},ansprechperson.ilike.${like}`)
    .order('kundennummer').limit(LIMIT)
  // Rechnungen/Offerten auch über den Kundennamen finden.
  const customerIds = (customers ?? []).map(c => c.id as string)
  const byCustomer = customerIds.length ? `,customer_id.in.(${customerIds.join(',')})` : ''

  const [invoices, quotes, entries, projects] = await Promise.all([
    supabase.from('invoices')
      .select('id, rechnungsnummer, rechnungsdatum, betrag, status, customer_id, customer:customers(firma_oder_name)')
      .or(`rechnungsnummer.ilike.${like},notiz.ilike.${like}${byCustomer}`)
      .order('rechnungsdatum', { ascending: false }).limit(LIMIT),
    supabase.from('quotes')
      .select('id, offertnummer, offertdatum, betrag, status, customer_id, customer:customers(firma_oder_name)')
      .or(`offertnummer.ilike.${like},notiz.ilike.${like}${byCustomer}`)
      .order('offertdatum', { ascending: false }).limit(LIMIT),
    supabase.from('time_entries')
      .select('id, datum, beschreibung, stunden, customer_id, customer:customers(firma_oder_name)')
      .ilike('beschreibung', like)
      .order('datum', { ascending: false }).limit(LIMIT),
    mitProjekten
      ? supabase.from('projects').select('id, title, description').or(`title.ilike.${like},description.ilike.${like}`).limit(LIMIT)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const name = (r: any) => (Array.isArray(r.customer) ? r.customer[0] : r.customer)?.firma_oder_name ?? ''
  return [
    ...(customers ?? []).map(c => ({
      id: c.id, group: 'Kunden' as const, title: c.firma_oder_name, subtitle: [c.ort, c.email].filter(Boolean).join(' · '),
      href: `/admin/kunden/${c.id}/konto`,
    })),
    ...(invoices.data ?? []).map((i: any) => ({
      id: i.id, group: 'Rechnungen' as const, title: i.rechnungsnummer,
      subtitle: `${name(i)} · ${formatDatum(i.rechnungsdatum)} · ${formatChf(Number(i.betrag))}`,
      href: i.status === 'entwurf'
        ? `/admin/rechnungen/${i.id}/bearbeiten`
        : `/admin/rechnungen?kunde=${i.customer_id}&jahr=${i.rechnungsdatum.slice(0, 4)}`,
    })),
    ...(quotes.data ?? []).map((o: any) => ({
      id: o.id, group: 'Offerten' as const, title: o.offertnummer,
      subtitle: `${name(o)} · ${formatDatum(o.offertdatum)} · ${formatChf(Number(o.betrag))}`,
      href: o.status === 'entwurf' ? `/admin/offerten/${o.id}/bearbeiten` : `/admin/offerten?kunde=${o.customer_id}&jahr=alle`,
    })),
    ...(entries.data ?? []).map((e: any) => ({
      id: e.id, group: 'Zeiteinträge' as const, title: e.beschreibung,
      subtitle: `${name(e)} · ${formatDatum(e.datum)} · ${e.stunden} Std.`,
      href: `/admin/zeiterfassung?kunde=${e.customer_id}&status=alle&jahr=${e.datum.slice(0, 4)}`,
    })),
    ...(projects.data ?? []).map((p: any) => ({
      id: p.id, group: 'Projekte' as const, title: p.title, subtitle: String(p.description ?? '').slice(0, 80),
      href: `/admin/projekte/${p.id}/bearbeiten`,
    })),
  ]
}
