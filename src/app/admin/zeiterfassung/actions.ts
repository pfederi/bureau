'use server'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { parseTimeEntryForm, createTimeEntry, updateTimeEntry, deleteTimeEntry } from '@/lib/db/timeEntries'
import { setProjectRate } from '@/lib/db/rates'

export async function addTimeEntry(formData: FormData): Promise<{ ok: boolean; error?: string; hinweis?: string }> {
  await requireSession()
  let input
  try {
    input = parseTimeEntryForm(formData)
    await createTimeEntry(input)
  } catch {
    return { ok: false, error: 'Eintrag konnte nicht gespeichert werden. Bitte Eingaben prüfen.' }
  }
  revalidatePath('/admin/zeiterfassung')
  // Eintrag ist gespeichert; scheitert nur das Merken, nicht nochmals speichern lassen (sonst doppelt)
  if (formData.get('ansatz_merken') === 'on' && input.projekt && input.stundensatz > 0) {
    try {
      await setProjectRate(input.customer_id, input.projekt, input.stundensatz)
      revalidatePath(`/admin/kunden/${input.customer_id}/konto`)
    } catch {
      return { ok: true, hinweis: 'Eintrag gespeichert, der Ansatz für das Projekt konnte aber nicht gemerkt werden.' }
    }
  }
  return { ok: true }
}

export async function updateTimeEntryAction(id: string, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireSession()
  try {
    await updateTimeEntry(id, parseTimeEntryForm(formData))
  } catch {
    return { ok: false, error: 'Eintrag konnte nicht aktualisiert werden.' }
  }
  revalidatePath('/admin/zeiterfassung')
  return { ok: true }
}

export async function deleteTimeEntryAction(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireSession()
  try {
    await deleteTimeEntry(id)
  } catch {
    return { ok: false, error: 'Eintrag konnte nicht gelöscht werden.' }
  }
  revalidatePath('/admin/zeiterfassung')
  return { ok: true }
}
