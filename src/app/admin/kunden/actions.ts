'use server'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { parseCustomerForm, createCustomer, updateCustomer, deleteCustomer } from '@/lib/db/customers'

type Result = { ok: boolean; error?: string }

export async function addCustomer(formData: FormData): Promise<Result> {
  await requireSession()
  try {
    await createCustomer(parseCustomerForm(formData))
  } catch {
    return { ok: false, error: 'Kunde konnte nicht angelegt werden. Bitte Eingaben prüfen.' }
  }
  revalidatePath('/admin/kunden')
  revalidatePath('/admin', 'layout') // Kundenliste in der Seitenleiste
  return { ok: true }
}

export async function editCustomer(id: string, formData: FormData): Promise<Result> {
  await requireSession()
  try {
    await updateCustomer(id, parseCustomerForm(formData))
  } catch {
    return { ok: false, error: 'Kunde konnte nicht gespeichert werden. Bitte Eingaben prüfen.' }
  }
  revalidatePath('/admin/kunden')
  revalidatePath('/admin', 'layout') // Kundenliste in der Seitenleiste
  return { ok: true }
}

export async function deleteCustomerAction(id: string): Promise<Result> {
  await requireSession()
  try {
    await deleteCustomer(id)
  } catch (e: any) {
    if (e?.code === '23503') {
      return { ok: false, error: 'Kunde kann nicht gelöscht werden – es existieren Rechnungen oder Zeiteinträge.' }
    }
    return { ok: false, error: 'Löschen fehlgeschlagen.' }
  }
  revalidatePath('/admin/kunden')
  revalidatePath('/admin', 'layout') // Kundenliste in der Seitenleiste
  return { ok: true }
}
