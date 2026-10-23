'use server'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { setInvoiceStatus, deleteInvoiceDraft, setInvoiceVerrechnung, stornoInvoice } from '@/lib/db/invoices'
import { syncCustomerAccount } from '@/modules/material'
import { createServerSupabase } from '@/lib/supabase/server'
import type { InvoiceStatus } from '@/lib/types'

async function getAccountInfo(id: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('invoices').select('customer_id, status, verrechnung_material').eq('id', id).single()
  if (error) throw error
  return data as { customer_id: string; status: InvoiceStatus; verrechnung_material: boolean }
}

export async function setStatusAction(id: string, status: InvoiceStatus) {
  await requireSession()
  await setInvoiceStatus(id, status, {
    paid_at: status === 'bezahlt' ? new Date().toISOString() : null,
    ...(status === 'versendet' ? { sent_at: new Date().toISOString() } : {}),
  })
  // Konto-Rechnungen: Status ergibt sich aus der Deckung, nicht aus dem Knopf.
  const info = await getAccountInfo(id)
  if (info.verrechnung_material) await syncCustomerAccount(info.customer_id)
  revalidatePath('/admin')
}

export async function setVerrechnungAction(id: string, verrechnung: boolean): Promise<{ ok: boolean; error?: string }> {
  await requireSession()
  try {
    const info = await getAccountInfo(id)
    await setInvoiceVerrechnung(id, verrechnung)
    // Aus dem Konto genommen: zurück auf „versendet", die Zahlung wird wieder manuell markiert.
    if (!verrechnung && info.status === 'bezahlt') await setInvoiceStatus(id, 'versendet', { paid_at: null })
    await syncCustomerAccount(info.customer_id)
  } catch {
    return { ok: false, error: 'Verrechnung konnte nicht geändert werden.' }
  }
  revalidatePath('/admin')
  return { ok: true }
}

export async function stornoInvoiceAction(id: string, kopie: boolean): Promise<{ ok: boolean; error?: string; newId?: string | null }> {
  await requireSession()
  let newId: string | null
  try {
    newId = await stornoInvoice(id, kopie, new Date().toISOString().slice(0, 10))
  } catch {
    return { ok: false, error: 'Stornieren fehlgeschlagen.' }
  }
  revalidatePath('/admin', 'layout')
  return { ok: true, newId }
}

export async function deleteInvoiceAction(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireSession()
  try {
    await deleteInvoiceDraft(id)
  } catch {
    return { ok: false, error: 'Löschen fehlgeschlagen.' }
  }
  revalidatePath('/admin')
  return { ok: true }
}
