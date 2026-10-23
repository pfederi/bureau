'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { createQuote, updateQuoteDraft, deleteQuoteDraft, setQuoteStatus, convertQuoteToInvoice, type QuoteInput } from '@/lib/db/quotes'
import { normalizeDiscountPercent } from '@/lib/invoices/calc'
import { parseItemsField } from '@/lib/invoices/items'
import type { QuoteStatus } from '@/lib/types'

function parseQuoteForm(formData: FormData): QuoteInput {
  return {
    customer_id: String(formData.get('customer_id')),
    offertdatum: String(formData.get('offertdatum')),
    gueltig_bis: (formData.get('gueltig_bis') as string) || null,
    notiz: (formData.get('notiz') as string) || null,
    mwst_hinweis: String(formData.get('mwst_hinweis')),
    rabatt_prozent: normalizeDiscountPercent(formData.get('rabatt_prozent')),
    items: parseItemsField(formData),
  }
}

export async function createQuoteAction(formData: FormData) {
  await requireSession()
  await createQuote(parseQuoteForm(formData))
  revalidatePath('/admin', 'layout')
  redirect('/admin/offerten')
}

export async function updateQuoteAction(id: string, formData: FormData) {
  await requireSession()
  await updateQuoteDraft(id, parseQuoteForm(formData))
  revalidatePath('/admin', 'layout')
  redirect('/admin/offerten')
}

type Result = { ok: boolean; error?: string }

export async function setQuoteStatusAction(id: string, status: QuoteStatus): Promise<Result> {
  await requireSession()
  try {
    await setQuoteStatus(id, status)
  } catch {
    return { ok: false, error: 'Status konnte nicht geändert werden.' }
  }
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

export async function deleteQuoteAction(id: string): Promise<Result> {
  await requireSession()
  try {
    await deleteQuoteDraft(id)
  } catch {
    return { ok: false, error: 'Löschen fehlgeschlagen.' }
  }
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

export async function convertQuoteAction(id: string): Promise<Result & { invoiceId?: string }> {
  await requireSession()
  try {
    const invoiceId = await convertQuoteToInvoice(id, new Date().toISOString().slice(0, 10))
    revalidatePath('/admin', 'layout')
    return { ok: true, invoiceId }
  } catch (e: any) {
    return { ok: false, error: e?.message?.startsWith('Aus dieser') ? e.message : 'Rechnung konnte nicht erstellt werden.' }
  }
}
