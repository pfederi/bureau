import { createServerSupabase } from '@/lib/supabase/server'
import { computeInvoiceTotal, computeDiscountedTotals } from '@/lib/invoices/calc'
import { formatInvoiceNumber } from '@/lib/invoices/number'
import type { Customer, Invoice, InvoiceItem, InvoiceStatus, InvoiceType } from '@/lib/types'
import { syncCustomerAccount } from '@/modules/material'

export type CreateInvoiceInput = {
  customer_id: string
  typ: InvoiceType
  rechnungsdatum: string
  leistungsdatum: string | null
  notiz: string | null
  mwst_hinweis: string
  rabatt_prozent: number
  items: InvoiceItem[]
  timeEntryIds?: string[]
}

type PayloadInput = Omit<CreateInvoiceInput, 'timeEntryIds'> & { rechnungsnummer: string }

export function buildInvoicePayload(input: PayloadInput) {
  const { total: betrag } = computeDiscountedTotals(computeInvoiceTotal(input.items), input.rabatt_prozent)
  const invoice = {
    rechnungsnummer: input.rechnungsnummer,
    customer_id: input.customer_id,
    typ: input.typ,
    status: 'entwurf' as InvoiceStatus,
    rechnungsdatum: input.rechnungsdatum,
    leistungsdatum: input.leistungsdatum,
    betrag,
    rabatt_prozent: input.rabatt_prozent,
    waehrung: 'CHF',
    notiz: input.notiz,
    mwst_hinweis: input.mwst_hinweis,
  }
  return { invoice, items: input.items }
}

export async function createInvoice(input: CreateInvoiceInput): Promise<string> {
  const supabase = await createServerSupabase()

  // Kundennummer holen
  const { data: cust, error: custErr } = await supabase
    .from('customers').select('kundennummer').eq('id', input.customer_id).single()
  if (custErr) throw custErr

  // Kundenweiten Zähler atomar beziehen
  const { data: counter, error: rpcErr } = await supabase
    .rpc('next_invoice_number_for_customer', { p_customer_id: input.customer_id })
  if (rpcErr) throw rpcErr

  const rechnungsnummer = formatInvoiceNumber(
    new Date(input.rechnungsdatum + 'T00:00:00Z'),
    cust.kundennummer as number,
    counter as number,
  )

  const { invoice, items } = buildInvoicePayload({ ...input, rechnungsnummer })

  const { data: newId, error } = await supabase.rpc('create_invoice_tx', {
    p_rechnungsnummer: invoice.rechnungsnummer,
    p_customer_id: invoice.customer_id,
    p_typ: invoice.typ,
    p_rechnungsdatum: invoice.rechnungsdatum,
    p_leistungsdatum: invoice.leistungsdatum,
    p_betrag: invoice.betrag,
    p_notiz: invoice.notiz,
    p_mwst_hinweis: invoice.mwst_hinweis,
    p_items: items,
    p_time_entry_ids: input.timeEntryIds ?? [],
    p_rabatt_prozent: invoice.rabatt_prozent,
  })
  if (error) throw error
  return newId as string
}

export type UpdateInvoiceInput = {
  customer_id: string
  typ: InvoiceType
  rechnungsdatum: string
  leistungsdatum: string | null
  notiz: string | null
  mwst_hinweis: string
  rabatt_prozent: number
  items: InvoiceItem[]
}

export async function updateInvoiceDraft(id: string, input: UpdateInvoiceInput): Promise<void> {
  const supabase = await createServerSupabase()
  const { total: betrag } = computeDiscountedTotals(computeInvoiceTotal(input.items), input.rabatt_prozent)
  const { error } = await supabase.rpc('update_invoice_tx', {
    p_id: id,
    p_customer_id: input.customer_id,
    p_typ: input.typ,
    p_rechnungsdatum: input.rechnungsdatum,
    p_leistungsdatum: input.leistungsdatum,
    p_notiz: input.notiz,
    p_mwst_hinweis: input.mwst_hinweis,
    p_betrag: betrag,
    p_items: input.items,
    p_rabatt_prozent: input.rabatt_prozent,
  })
  if (error) throw error
}

/**
 * Löscht nur Entwürfe. Zeiterfassungs-Einträge, die für diese Rechnung
 * verwendet wurden, werden zuerst wieder als unfakturiert markiert, sonst
 * blieben sie durch das `on delete set null` der invoice_id dauerhaft
 * "billed" und wären nie mehr verrechenbar.
 */
export async function deleteInvoiceDraft(id: string): Promise<void> {
  const supabase = await createServerSupabase()

  const { data: inv, error: fetchErr } = await supabase
    .from('invoices').select('status').eq('id', id).single()
  if (fetchErr) throw fetchErr
  if ((inv as { status: InvoiceStatus }).status !== 'entwurf') {
    throw new Error('Nur Entwürfe können gelöscht werden.')
  }

  const { error: teErr } = await supabase
    .from('time_entries').update({ billed: false }).eq('invoice_id', id)
  if (teErr) throw teErr

  const { error } = await supabase.from('invoices').delete().eq('id', id)
  if (error) throw error
}

/** Merkt sich, für welches Jahr die Rechnung das Hosting enthält (null = kein Hosting). */
export async function setInvoiceHostingYear(id: string, jahr: number | null): Promise<void> {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('invoices').update({ hosting_jahr: jahr }).eq('id', id)
  if (error) throw error
}

export async function setInvoiceReminded(id: string): Promise<void> {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('invoices').update({ erinnert_am: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

/** Rechnung über das Kundenkonto (Material) verrechnen oder normal bezahlen lassen. */
export async function setInvoiceVerrechnung(id: string, verrechnung: boolean): Promise<void> {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('invoices').update({ verrechnung_material: verrechnung }).eq('id', id)
  if (error) throw error
}

export type HostingBilled = { invoice_id: string; customer_id: string; hosting_jahr: number; rechnungsnummer: string }

export async function listHostingBilled(): Promise<HostingBilled[]> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('invoices')
    .select('id, customer_id, hosting_jahr, rechnungsnummer')
    .not('hosting_jahr', 'is', null)
    .neq('status', 'storniert')
  if (error) throw error
  return (data ?? []).map(r => ({
    invoice_id: r.id as string,
    customer_id: r.customer_id as string,
    hosting_jahr: Number(r.hosting_jahr),
    rechnungsnummer: r.rechnungsnummer as string,
  }))
}

export async function listInvoices(filter: { customerId?: string; jahr?: string; status?: InvoiceStatus } = {}) {
  const supabase = await createServerSupabase()
  let query = supabase
    .from('invoices')
    .select('*, customer:customers(*)')
    .order('rechnungsdatum', { ascending: false })
  if (filter.customerId) query = query.eq('customer_id', filter.customerId)
  if (filter.status) query = query.eq('status', filter.status)
  if (filter.jahr) {
    query = query.gte('rechnungsdatum', `${filter.jahr}-01-01`).lt('rechnungsdatum', `${Number(filter.jahr) + 1}-01-01`)
  }
  const { data, error } = await query
  if (error) throw error
  return data as (Invoice & { customer: Customer })[]
}

export async function getInvoiceWithItems(id: string) {
  const supabase = await createServerSupabase()
  const { data: invoice, error } = await supabase
    .from('invoices').select('*, customer:customers(*)').eq('id', id).single()
  if (error) throw error
  const { data: items, error: itemsErr } = await supabase
    .from('invoice_items').select('*').eq('invoice_id', id).order('position')
  if (itemsErr) throw itemsErr
  const { customer, ...rest } = invoice as any
  return { invoice: rest as Invoice, items: items as InvoiceItem[], customer: customer as Customer }
}

export async function setInvoiceStatus(
  id: string,
  status: InvoiceStatus,
  opts?: { sent_at?: string | null; paid_at?: string | null },
): Promise<void> {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('invoices').update({ status, ...opts }).eq('id', id)
  if (error) throw error
}

/**
 * Storniert eine versendete oder bezahlte Rechnung. Sie zählt danach nicht mehr
 * zu Umsatz, MWST und Kundenkonto. Mit `kopie` entsteht ein neuer Entwurf mit
 * denselben Positionen, und die Zeiteinträge wandern zu diesem; sonst werden sie
 * wieder offen. Gibt die Id des neuen Entwurfs zurück (oder null).
 */
export async function stornoInvoice(id: string, kopie: boolean, today: string): Promise<string | null> {
  const supabase = await createServerSupabase()
  const { invoice, items } = await getInvoiceWithItems(id)
  if (invoice.status !== 'versendet' && invoice.status !== 'bezahlt') {
    throw new Error('Nur versendete oder bezahlte Rechnungen können storniert werden.')
  }

  const { error: stornoErr } = await supabase.from('invoices')
    .update({ status: 'storniert', storniert_am: new Date().toISOString() }).eq('id', id)
  if (stornoErr) throw stornoErr

  let newId: string | null = null
  if (kopie) {
    newId = await createInvoice({
      customer_id: invoice.customer_id,
      typ: invoice.typ,
      rechnungsdatum: today,
      leistungsdatum: invoice.leistungsdatum,
      notiz: invoice.notiz,
      mwst_hinweis: invoice.mwst_hinweis,
      rabatt_prozent: Number(invoice.rabatt_prozent ?? 0),
      items: items.map(({ id: _id, ...it }) => it),
    })
    const { error: copyErr } = await supabase.from('invoices')
      .update({ hosting_jahr: invoice.hosting_jahr, verrechnung_material: invoice.verrechnung_material, offerte_id: invoice.offerte_id })
      .eq('id', newId)
    if (copyErr) throw copyErr
  }

  const { error: teErr } = await supabase.from('time_entries')
    .update(newId ? { invoice_id: newId } : { billed: false, invoice_id: null })
    .eq('invoice_id', id)
  if (teErr) throw teErr

  if (invoice.verrechnung_material) await syncCustomerAccount(invoice.customer_id)
  return newId
}
