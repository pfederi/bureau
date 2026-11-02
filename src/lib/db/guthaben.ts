import { createServerSupabase } from '@/lib/supabase/server'
import { guthabenSaldo, planAnrechnung, zuBezahlen, type GuthabenRechnung } from '@/lib/invoices/guthaben'
import type { CustomerGuthaben, InvoiceStatus } from '@/lib/types'

const RECHNUNG_SPALTEN = 'id, customer_id, status, rechnungsnummer, rechnungsdatum, guthaben_angerechnet'

export async function listGuthaben(customerId: string): Promise<CustomerGuthaben[]> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('customer_guthaben').select('*').eq('customer_id', customerId).order('datum').order('created_at')
  if (error) throw error
  return data as CustomerGuthaben[]
}

async function rechnungenMitGuthaben(customerId?: string): Promise<(GuthabenRechnung & { customer_id: string })[]> {
  const supabase = await createServerSupabase()
  let q = supabase.from('invoices').select(RECHNUNG_SPALTEN).gt('guthaben_angerechnet', 0)
  if (customerId) q = q.eq('customer_id', customerId)
  const { data, error } = await q
  if (error) throw error
  return data as (GuthabenRechnung & { customer_id: string })[]
}

/** Verfügbares Guthaben pro Kunde (nur Kunden mit Guthaben > 0). */
export async function listGuthabenSaldi(): Promise<Record<string, number>> {
  const supabase = await createServerSupabase()
  const [{ data, error }, rechnungen] = await Promise.all([
    supabase.from('customer_guthaben').select('customer_id, betrag'),
    rechnungenMitGuthaben(),
  ])
  if (error) throw error
  const out: Record<string, number> = {}
  for (const id of new Set((data ?? []).map(e => e.customer_id as string))) {
    const saldo = guthabenSaldo((data ?? []).filter(e => e.customer_id === id), rechnungen.filter(r => r.customer_id === id))
    if (saldo > 0) out[id] = saldo
  }
  return out
}

export async function addGuthaben(input: Pick<CustomerGuthaben, 'customer_id' | 'datum' | 'betrag' | 'beschreibung' | 'invoice_id'>): Promise<void> {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('customer_guthaben').insert(input)
  if (error) throw error
}

/** Löscht ein Guthaben, solange es nicht schon angerechnet ist (Saldo bliebe sonst negativ), und gibt es zurück. */
export async function deleteGuthaben(id: string): Promise<CustomerGuthaben> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase.from('customer_guthaben').select('*').eq('id', id).single()
  if (error) throw error
  const eintrag = data as CustomerGuthaben
  const [eintraege, rechnungen] = await Promise.all([listGuthaben(eintrag.customer_id), rechnungenMitGuthaben(eintrag.customer_id)])
  if (guthabenSaldo(eintraege.filter(e => e.id !== id), rechnungen) < 0) {
    throw new GuthabenFehler('Dieses Guthaben ist schon angerechnet. Zuerst die Anrechnung an der Rechnung entfernen.')
  }
  // Nur wer die Zeile wirklich gelöscht hat, macht weiter (z. B. kein doppelter Übertrag bei Doppelklick)
  const { data: geloescht, error: delErr } = await supabase.from('customer_guthaben').delete().eq('id', id).select('id')
  if (delErr) throw delErr
  if (!geloescht?.length) throw new GuthabenFehler('Dieses Guthaben ist schon gelöscht oder übertragen.')
  return eintrag
}

/** Fehler mit Meldung für den Nutzer. */
export class GuthabenFehler extends Error {}

type RechnungInfo = { id: string; customer_id: string; status: InvoiceStatus; betrag: number; verrechnung_material: boolean }

/**
 * Rechnet verfügbares Guthaben an der Rechnung an (oder berechnet die Anrechnung neu).
 * Eine versendete Rechnung, die damit ganz gedeckt ist, gilt als bezahlt. Gibt den Betrag zurück.
 */
export async function applyGuthaben(invoiceId: string): Promise<number> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('invoices').select('id, customer_id, status, betrag, verrechnung_material').eq('id', invoiceId).single()
  if (error) throw error
  const inv = data as RechnungInfo
  if (inv.status === 'storniert' || inv.status === 'bezahlt') throw new GuthabenFehler('Nur an offenen Rechnungen und Entwürfen anrechenbar.')
  if (inv.verrechnung_material) throw new GuthabenFehler('Rechnungen mit Material-Verrechnung laufen über das Kundenkonto.')
  const [eintraege, rechnungen] = await Promise.all([listGuthaben(inv.customer_id), rechnungenMitGuthaben(inv.customer_id)])
  const plan = planAnrechnung(eintraege, rechnungen, inv)
  const voll = inv.status === 'versendet' && plan.betrag > 0 && zuBezahlen({ betrag: inv.betrag, guthaben_angerechnet: plan.betrag }) === 0
  const { error: updErr } = await supabase.from('invoices').update({
    guthaben_angerechnet: plan.betrag,
    guthaben_text: plan.text,
    ...(voll ? { status: 'bezahlt', paid_at: new Date().toISOString() } : {}),
  }).eq('id', invoiceId)
  if (updErr) throw updErr
  return plan.betrag
}

/** Nimmt die Anrechnung zurück (Entwurf oder versendete Rechnung); das Guthaben ist wieder frei. */
export async function removeGuthaben(invoiceId: string): Promise<void> {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('invoices')
    .update({ guthaben_angerechnet: 0, guthaben_text: null })
    .eq('id', invoiceId).in('status', ['entwurf', 'versendet'])
  if (error) throw error
}
