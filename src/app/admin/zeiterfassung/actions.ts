'use server'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { parseTimeEntryForm, createTimeEntry, updateTimeEntry, deleteTimeEntry } from '@/lib/db/timeEntries'

export async function addTimeEntry(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireSession()
  try {
    await createTimeEntry(parseTimeEntryForm(formData))
  } catch {
    return { ok: false, error: 'Eintrag konnte nicht gespeichert werden. Bitte Eingaben prüfen.' }
  }
  revalidatePath('/admin/zeiterfassung')
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
