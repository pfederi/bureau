import { cache } from 'react'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { isPortalToken } from '@/lib/portal/path'
import { listCreditsFor } from '@/modules/material'
import type { Customer, Invoice, InvoiceItem, Quote, Settings, TimeEntry } from '@/lib/types'
import type { AntwortInput, PortalQuote } from '@/lib/portal/quotes'
import type { PortalSite } from '@/lib/monitoring/sites'
import type { GuthabenEintrag } from '@/lib/invoices/guthaben'

/**
 * Daten für die öffentliche Kundenseite. Ohne Anmeldung, darum mit Service-Key –
 * aber immer eingeschränkt auf den Kunden, dem das Token gehört.
 */
export async function getPortalCustomer(token: string): Promise<Customer | null> {
  if (!isPortalToken(token)) return null
  const { data } = await createAdminSupabase().from('customers').select('*').eq('portal_token', token).maybeSingle()
  return (data as Customer | null) ?? null
}

/** Zeiteinträge für Budget und Stunden-Übersicht – ohne Projekt und Erfassungszeit. */
const PORTAL_TIME_COLUMNS = 'id, customer_id, datum, beschreibung, stunden, stundensatz, billed, invoice_id'
type PortalTimeEntry = Pick<TimeEntry, 'id' | 'customer_id' | 'datum' | 'beschreibung' | 'stunden' | 'stundensatz' | 'billed' | 'invoice_id'>
/** Website-Status ohne Fehlermeldung, HTTP-Status und Antwortzeit. */
const PORTAL_SITE_COLUMNS = 'id, url, erreichbar, fehlversuche, down_seit, geprueft_am, ssl_ablauf, domain_ablauf'
/** Guthaben (z. B. Überzahlungen) ohne Bezug zu internen Feldern */
const PORTAL_GUTHABEN_COLUMNS = 'id, datum, betrag, beschreibung, created_at'
/** Offerten-Liste im Kundenlink: nur was die Karte zeigt (Notiz und Positionen stehen im PDF, der Grund einer Ablehnung bleibt intern) */
const PORTAL_QUOTE_COLUMNS = 'id, offertnummer, status, offertdatum, gueltig_bis, betrag, antwort_am, antwort_name'

/** Einmal pro Anfrage (generateMetadata und Seite teilen sich das Ergebnis). */
export const loadPortal = cache(async (token: string) => {
  const customer = await getPortalCustomer(token)
  if (!customer) return null
  const db = createAdminSupabase()
  const [inv, credits, te, se, sites, gh, qu] = await Promise.all([
    db.from('invoices').select('*').eq('customer_id', customer.id).neq('status', 'entwurf').order('rechnungsdatum', { ascending: false }),
    listCreditsFor(db, customer.id),
    db.from('time_entries').select(PORTAL_TIME_COLUMNS).eq('customer_id', customer.id).order('datum', { ascending: false }),
    db.from('settings').select('*').eq('id', 1).single(),
    db.from('monitored_sites').select(PORTAL_SITE_COLUMNS).eq('customer_id', customer.id).order('created_at'),
    db.from('customer_guthaben').select(PORTAL_GUTHABEN_COLUMNS).eq('customer_id', customer.id).order('datum'),
    db.from('quotes').select(PORTAL_QUOTE_COLUMNS).eq('customer_id', customer.id).neq('status', 'entwurf').order('offertdatum', { ascending: false }),
  ])
  // Guthaben ändert, was der Kunde zahlen muss: ohne diese Daten lieber eine Fehlerseite als falsche Beträge
  const fehler = [inv, te, se, gh].find(r => r.error)?.error
  if (fehler) throw fehler
  // Website-Status ist Zusatz: scheitert die Abfrage, zeigt die Seite den Rest trotzdem
  if (sites.error) console.error('Kundenseite: Websites nicht geladen', sites.error)
  // Offerten ebenso (z. B. vor Migration 0022)
  if (qu.error) console.error('Kundenseite: Offerten nicht geladen', qu.error)
  return {
    customer,
    invoices: inv.data as Invoice[],
    // Belege bleiben privat: nur Datum, Art, Beschreibung und Betrag
    credits: credits.map(({ beleg_path: _p, beleg_name: _n, ...c }) => c),
    timeEntries: te.data as PortalTimeEntry[],
    settings: se.data as Settings,
    sites: (sites.error ? [] : sites.data) as PortalSite[],
    guthaben: gh.data as GuthabenEintrag[],
    quotes: (qu.error ? [] : qu.data) as PortalQuote[],
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

/** Offerte für den PDF-Download auf der Kundenseite – nur eigene, keine Entwürfe. */
export async function getPortalQuote(token: string, quoteId: string) {
  const customer = await getPortalCustomer(token)
  if (!customer || !/^[0-9a-f-]{36}$/i.test(quoteId)) return null
  const db = createAdminSupabase()
  const [q, items, se] = await Promise.all([
    db.from('quotes').select('*').eq('id', quoteId).eq('customer_id', customer.id).neq('status', 'entwurf').maybeSingle(),
    db.from('quote_items').select('*').eq('quote_id', quoteId).order('position'),
    db.from('settings').select('*').eq('id', 1).single(),
  ])
  if (!q.data || items.error || se.error) return null
  return { quote: q.data as Quote, items: items.data as InvoiceItem[], customer, settings: se.data as Settings }
}

/**
 * Antwort des Kunden speichern: ein einziges bedingtes Update, beschränkt auf den Kunden des Tokens,
 * nur versendete und (in Zürcher Zeit) noch gültige Offerten. null = nicht (mehr) möglich.
 */
export async function answerPortalQuote(customerId: string, quoteId: string, input: AntwortInput, heute: string) {
  if (!/^[0-9a-f-]{36}$/i.test(quoteId) || !/^\d{4}-\d{2}-\d{2}$/.test(heute)) return null
  const jetzt = new Date().toISOString()
  const { data, error } = await createAdminSupabase()
    .from('quotes')
    .update({
      status: input.antwort === 'annehmen' ? 'angenommen' : 'abgelehnt',
      antwort_am: jetzt,
      antwort_name: input.name,
      antwort_grund: input.antwort === 'ablehnen' ? input.grund : null,
      antwort_via: 'kundenlink',
      updated_at: jetzt,
    })
    .eq('id', quoteId).eq('customer_id', customerId).eq('status', 'versendet')
    .or(`gueltig_bis.is.null,gueltig_bis.gte.${heute}`)
    .select('id, offertnummer, betrag')
    .maybeSingle()
  if (error) throw error
  return data as Pick<Quote, 'id' | 'offertnummer' | 'betrag'> | null
}

/** Einstellungen (Absender) für die Mail an den Inhaber nach einer Antwort. */
export async function portalSettings(): Promise<Settings> {
  const { data, error } = await createAdminSupabase().from('settings').select('*').eq('id', 1).single()
  if (error) throw error
  return data as Settings
}
