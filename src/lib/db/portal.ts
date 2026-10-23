import { cache } from 'react'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { isPortalToken } from '@/lib/portal/path'
import { listCreditsFor } from '@/modules/material'
import type { Customer, Invoice, InvoiceItem, Settings, TimeEntry } from '@/lib/types'

/**
 * Daten für die öffentliche Kundenseite. Ohne Anmeldung, darum mit Service-Key –
 * aber immer eingeschränkt auf den Kunden, dem das Token gehört.
 */
export async function getPortalCustomer(token: string): Promise<Customer | null> {
  if (!isPortalToken(token)) return null
  const { data } = await createAdminSupabase().from('customers').select('*').eq('portal_token', token).maybeSingle()
  return (data as Customer | null) ?? null
}

/** Einmal pro Anfrage (generateMetadata und Seite teilen sich das Ergebnis). */
export const loadPortal = cache(async (token: string) => {
  const customer = await getPortalCustomer(token)
  if (!customer) return null
  const db = createAdminSupabase()
  const [inv, credits, te, se] = await Promise.all([
    db.from('invoices').select('*').eq('customer_id', customer.id).neq('status', 'entwurf').order('rechnungsdatum', { ascending: false }),
    listCreditsFor(db, customer.id),
    db.from('time_entries').select('customer_id, datum, stunden').eq('customer_id', customer.id).gte('datum', `${new Date().getUTCFullYear()}-01-01`),
    db.from('settings').select('*').eq('id', 1).single(),
  ])
  const fehler = [inv, te, se].find(r => r.error)?.error
  if (fehler) throw fehler
  return {
    customer,
    invoices: inv.data as Invoice[],
    // Belege bleiben privat: nur Datum, Art, Beschreibung und Betrag
    credits: credits.map(({ beleg_path: _p, beleg_name: _n, ...c }) => c),
    timeEntries: te.data as Pick<TimeEntry, 'customer_id' | 'datum' | 'stunden'>[],
    settings: se.data as Settings,
  }
})

/** Rechnung für den PDF-Download auf der Kundenseite – nur eigene, keine Entwürfe. */
export async function getPortalInvoice(token: string, invoiceId: string) {
  const customer = await getPortalCustomer(token)
  if (!customer || !/^[0-9a-f-]{36}$/i.test(invoiceId)) return null
  const db = createAdminSupabase()
  const [inv, items, se] = await Promise.all([
    db.from('invoices').select('*').eq('id', invoiceId).eq('customer_id', customer.id).neq('status', 'entwurf').maybeSingle(),
    db.from('invoice_items').select('*').eq('invoice_id', invoiceId).order('position'),
    db.from('settings').select('*').eq('id', 1).single(),
  ])
  if (!inv.data || items.error || se.error) return null
  return { invoice: inv.data as Invoice, items: items.data as InvoiceItem[], customer, settings: se.data as Settings }
}
