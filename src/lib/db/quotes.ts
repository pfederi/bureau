import { createServerSupabase } from '@/lib/supabase/server'
import { computeInvoiceTotal, computeDiscountedTotals } from '@/lib/invoices/calc'
import { formatQuoteNumber } from '@/lib/invoices/number'
import { createInvoice } from '@/lib/db/invoices'
import type { Customer, InvoiceItem, Quote, QuoteStatus } from '@/lib/types'

export type QuoteInput = {
  customer_id: string
  offertdatum: string
  gueltig_bis: string | null
  notiz: string | null
  mwst_hinweis: string
  rabatt_prozent: number
  items: InvoiceItem[]
}

async function saveQuote(id: string | null, offertnummer: string | null, input: QuoteInput): Promise<string> {
  const supabase = await createServerSupabase()
  const { total: betrag } = computeDiscountedTotals(computeInvoiceTotal(input.items), input.rabatt_prozent)
  const { data, error } = await supabase.rpc('save_quote_tx', {
    p_id: id,
    p_offertnummer: offertnummer ?? '',
    p_customer_id: input.customer_id,
    p_offertdatum: input.offertdatum,
    p_gueltig_bis: input.gueltig_bis,
    p_betrag: betrag,
    p_rabatt_prozent: input.rabatt_prozent,
    p_notiz: input.notiz,
    p_mwst_hinweis: input.mwst_hinweis,
    p_items: input.items,
  })
  if (error) throw error
  return data as string
}

export async function createQuote(input: QuoteInput): Promise<string> {
  const supabase = await createServerSupabase()
  const { data: cust, error: custErr } = await supabase
    .from('customers').select('kundennummer').eq('id', input.customer_id).single()
  if (custErr) throw custErr
  const { data: counter, error: rpcErr } = await supabase
    .rpc('next_quote_number_for_customer', { p_customer_id: input.customer_id })
  if (rpcErr) throw rpcErr
  const nummer = formatQuoteNumber(new Date(input.offertdatum + 'T00:00:00Z'), cust.kundennummer as number, counter as number)
  return saveQuote(null, nummer, input)
}

export async function updateQuoteDraft(id: string, input: QuoteInput): Promise<void> {
  await saveQuote(id, null, input)
}

export async function listQuotes(filter: { customerId?: string; jahr?: string; status?: QuoteStatus } = {}) {
  const supabase = await createServerSupabase()
  let query = supabase.from('quotes').select('*, customer:customers(*)').order('offertdatum', { ascending: false })
  if (filter.customerId) query = query.eq('customer_id', filter.customerId)
  if (filter.status) query = query.eq('status', filter.status)
  if (filter.jahr) query = query.gte('offertdatum', `${filter.jahr}-01-01`).lt('offertdatum', `${Number(filter.jahr) + 1}-01-01`)
  const { data, error } = await query
  if (error) throw error
  return data as (Quote & { customer: Customer })[]
}

export async function getQuoteWithItems(id: string) {
  const supabase = await createServerSupabase()
  const { data: quote, error } = await supabase.from('quotes').select('*, customer:customers(*)').eq('id', id).single()
  if (error) throw error
  const { data: items, error: itemsErr } = await supabase.from('quote_items').select('*').eq('quote_id', id).order('position')
  if (itemsErr) throw itemsErr
  const { customer, ...rest } = quote as any
  return { quote: rest as Quote, items: items as InvoiceItem[], customer: customer as Customer }
}

export async function setQuoteStatus(id: string, status: QuoteStatus, extra: { sent_at?: string } = {}): Promise<void> {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('quotes').update({ status, ...extra, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function deleteQuoteDraft(id: string): Promise<void> {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('quotes').delete().eq('id', id).eq('status', 'entwurf')
  if (error) throw error
}

/**
 * Erstellt aus einer Offerte einen Rechnungsentwurf (gleiche Positionen und
 * Rabatt, Rechnungsdatum heute) und markiert die Offerte als angenommen.
 */
export async function convertQuoteToInvoice(id: string, today: string): Promise<string> {
  const { quote, items } = await getQuoteWithItems(id)
  if (quote.invoice_id) throw new Error('Aus dieser Offerte wurde bereits eine Rechnung erstellt.')
  const invoiceId = await createInvoice({
    customer_id: quote.customer_id,
    typ: 'pauschal',
    rechnungsdatum: today,
    leistungsdatum: null,
    notiz: null,
    mwst_hinweis: quote.mwst_hinweis,
    rabatt_prozent: Number(quote.rabatt_prozent ?? 0),
    items: items.map(({ id: _id, ...it }) => it),
  })
  const supabase = await createServerSupabase()
  const { error: invErr } = await supabase.from('invoices').update({ offerte_id: id }).eq('id', invoiceId)
  if (invErr) throw invErr
  const { error } = await supabase.from('quotes')
    .update({ status: 'angenommen', invoice_id: invoiceId, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
  return invoiceId
}
