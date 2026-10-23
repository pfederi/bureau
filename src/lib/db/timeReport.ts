import { createServerSupabase } from '@/lib/supabase/server'
import { getCustomer } from '@/lib/db/customers'
import { getSettings } from '@/lib/db/settings'
import { listTimeEntries } from '@/lib/db/timeEntries'
import { budgetUsage } from '@/lib/invoices/budget'
import { buildTimeReport, isMonth } from '@/lib/timeEntries/report'
import { renderTimeReportPdf } from '@/lib/pdf/timeReportPdf'

export type SentTimeReport = { id: string; monat: string; an: string; stunden: number; sent_at: string }

/** Stundenrapport eines Kunden für einen Monat (YYYY-MM) inkl. PDF; null ohne Kunde oder Einträge. */
export async function buildCustomerTimeReport(customerId: string, monat: string) {
  if (!isMonth(monat)) return null
  const [customer, entries, settings] = await Promise.all([
    getCustomer(customerId), listTimeEntries({ status: 'alle', customerId }), getSettings(),
  ])
  if (!customer) return null
  const report = buildTimeReport(entries, monat)
  if (report.eintraege.length === 0) return null
  // Budget per Ende des Rapportmonats (bei Jahresbudget: Verbrauch bis dahin)
  const [j, m] = monat.split('-').map(Number)
  const monatsende = new Date(Date.UTC(j, m, 0, 12))
  const budget = budgetUsage(customer, entries.filter(e => e.datum.slice(0, 7) <= monat), monatsende)
  const pdf = await renderTimeReportPdf({ report, customer, settings, budget, datum: new Date().toISOString().slice(0, 10) })
  return { customer, settings, report, pdf }
}

export async function listSentTimeReports(customerId: string): Promise<SentTimeReport[]> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase.from('time_reports').select('id, monat, an, stunden, sent_at')
    .eq('customer_id', customerId).order('sent_at', { ascending: false })
  if (error) throw error
  return (data as SentTimeReport[]).map(r => ({ ...r, monat: r.monat.slice(0, 7) }))
}

export async function recordSentTimeReport(r: { customer_id: string; monat: string; an: string; stunden: number }): Promise<void> {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('time_reports').insert({ ...r, monat: `${r.monat}-01` })
  if (error) throw error
}
