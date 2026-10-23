'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { createInvoice, updateInvoiceDraft, setInvoiceHostingYear, setInvoiceVerrechnung } from '@/lib/db/invoices'
import { listCustomers } from '@/lib/db/customers'
import { getSettings } from '@/lib/db/settings'
import { hostingItemForYear } from '@/lib/invoices/hosting'
import { computeItemTotal, normalizeDiscountPercent } from '@/lib/invoices/calc'
import { parseItemsField } from '@/lib/invoices/items'
import type { InvoiceType } from '@/lib/types'

function parseHostingYear(formData: FormData): number | null {
  const n = Number(formData.get('hosting_jahr'))
  return Number.isInteger(n) && n > 2000 ? n : null
}

export async function createInvoiceAction(formData: FormData) {
  await requireSession()

  const typ = formData.get('typ') as InvoiceType
  const customer_id = String(formData.get('customer_id'))
  const rechnungsdatum = String(formData.get('rechnungsdatum'))
  const leistungsdatum = (formData.get('leistungsdatum') as string) || null
  const notiz = (formData.get('notiz') as string) || null
  const mwst_hinweis = String(formData.get('mwst_hinweis'))
  const rabatt_prozent = normalizeDiscountPercent(formData.get('rabatt_prozent'))

  const items = parseItemsField(formData)

  const timeEntryIds = JSON.parse(String(formData.get('timeEntryIds') || '[]')) as string[]

  const id = await createInvoice({
    customer_id, typ, rechnungsdatum, leistungsdatum, notiz, mwst_hinweis, rabatt_prozent, items,
    timeEntryIds: typ === 'stunden' ? timeEntryIds : [],
  })
  const hostingJahr = parseHostingYear(formData)
  if (hostingJahr) await setInvoiceHostingYear(id, hostingJahr)
  if (formData.get('verrechnung_material') === 'on') await setInvoiceVerrechnung(id, true)

  revalidatePath('/admin')
  redirect('/admin')
}

export async function updateInvoiceAction(id: string, formData: FormData) {
  await requireSession()

  const typ = formData.get('typ') as InvoiceType
  const customer_id = String(formData.get('customer_id'))
  const rechnungsdatum = String(formData.get('rechnungsdatum'))
  const leistungsdatum = (formData.get('leistungsdatum') as string) || null
  const notiz = (formData.get('notiz') as string) || null
  const mwst_hinweis = String(formData.get('mwst_hinweis'))
  const rabatt_prozent = normalizeDiscountPercent(formData.get('rabatt_prozent'))

  const items = parseItemsField(formData)

  await updateInvoiceDraft(id, { customer_id, typ, rechnungsdatum, leistungsdatum, notiz, mwst_hinweis, rabatt_prozent, items })
  await setInvoiceHostingYear(id, parseHostingYear(formData))
  await setInvoiceVerrechnung(id, formData.get('verrechnung_material') === 'on')

  revalidatePath('/admin')
  redirect('/admin')
}

/** Erstellt für die gewählten Kunden je einen Hosting-Rechnungsentwurf für `jahr`. */
export async function createHostingInvoicesAction(jahr: number, customerIds: string[]): Promise<{ ok: boolean; count: number; error?: string }> {
  await requireSession()
  try {
    const [customers, settings] = await Promise.all([listCustomers(), getSettings()])
    const today = new Date().toISOString().slice(0, 10)
    let count = 0
    for (const c of customers.filter(c => customerIds.includes(c.id))) {
      const item = hostingItemForYear(c, jahr)
      if (!item) continue
      const id = await createInvoice({
        customer_id: c.id,
        typ: 'pauschal',
        rechnungsdatum: today,
        leistungsdatum: String(jahr),
        notiz: null,
        mwst_hinweis: settings.mwst_hinweis,
        rabatt_prozent: 0,
        items: [{ position: 1, ...item, gesamtpreis: computeItemTotal(item.menge, item.einzelpreis) }],
      })
      await setInvoiceHostingYear(id, jahr)
      count++
    }
    revalidatePath('/admin', 'layout')
    return { ok: true, count }
  } catch {
    return { ok: false, count: 0, error: 'Hosting-Rechnungen konnten nicht erstellt werden.' }
  }
}
