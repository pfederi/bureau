'use server'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { parseExpenseForm, createExpense, updateExpense, deleteExpense, listExpenses } from '@/lib/db/expenses'
import { findDuplicates, type DuplicateCandidate } from '@/lib/expenses/duplicates'
import { formatChf } from '@/lib/invoices/stats'
import { getSettings, updateSettings } from '@/lib/db/settings'
import { formatDatum } from '@/lib/utils'
import { deleteBelegEingang, getBelegEingang } from '@/lib/db/belegEingang'
import { eingangDateiLoeschen } from '@/lib/inbound/belege'

type Result = { ok: boolean; error?: string }

export async function addExpenseAction(formData: FormData): Promise<Result & { id?: string }> {
  await requireSession()
  let input
  let id: string | null
  try {
    input = parseExpenseForm(formData)
    id = await createExpense(input)
  } catch {
    return { ok: false, error: 'Ausgabe konnte nicht gespeichert werden. Bitte Eingaben prüfen.' }
  }
  // Aus dem Eingang übernommen: Eintrag entfernen (die Ausgabe ist gespeichert, ein Fehler hier wird nur geloggt,
  // sonst würde ein erneuter Versuch sie doppelt anlegen). Die Datei bleibt, wenn sie jetzt der Beleg der Ausgabe ist.
  const eingangId = formData.get('eingang_id')
  if (typeof eingangId === 'string' && /^[0-9a-f-]{36}$/i.test(eingangId)) {
    try {
      const eintrag = await getBelegEingang(eingangId)
      if (eintrag) await deleteBelegEingang(eingangId, eingangDateiLoeschen(eintrag.beleg_path, input.beleg_path))
    } catch (e) {
      console.error('[belege per mail] Eingang nach dem Speichern nicht aufgeräumt', e)
    }
  }
  revalidatePath('/admin', 'layout')
  return { ok: true, id: id ?? undefined }
}

export async function updateExpenseAction(id: string, formData: FormData): Promise<Result> {
  await requireSession()
  try {
    await updateExpense(id, parseExpenseForm(formData))
  } catch {
    return { ok: false, error: 'Ausgabe konnte nicht aktualisiert werden. Bitte Eingaben prüfen.' }
  }
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

export async function deleteExpenseAction(id: string): Promise<Result> {
  await requireSession()
  try {
    await deleteExpense(id)
  } catch {
    return { ok: false, error: 'Ausgabe konnte nicht gelöscht werden.' }
  }
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

/** Mögliche Duplikate für den Dialog, als lesbare Hinweise. */
export async function checkDuplicatesAction(candidate: DuplicateCandidate): Promise<string[]> {
  await requireSession()
  const matches = findDuplicates(candidate, await listExpenses())
  return matches.slice(0, 3).map(m =>
    `${m.expense.beschreibung} vom ${formatDatum(m.expense.datum)} (${formatChf(Number(m.expense.betrag))}) – ${m.grund}`)
}

/** Hinweis auf einen fehlenden Beleg ausblenden – gilt für Ausgaben, Dashboard und Wochenmail. */
export async function hideRecurringAction(ids: string[]): Promise<Result> {
  await requireSession()
  try {
    const bisher = (await getSettings()).belege_ausgeblendet ?? []
    const neu = ids.filter(id => !bisher.includes(id))
    if (neu.length) await updateSettings({ belege_ausgeblendet: [...bisher, ...neu] })
  } catch {
    return { ok: false, error: 'Hinweis konnte nicht ausgeblendet werden.' }
  }
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

export async function discardBelegEingangAction(id: string): Promise<Result> {
  await requireSession()
  try {
    await deleteBelegEingang(id, true)
  } catch {
    return { ok: false, error: 'Beleg konnte nicht verworfen werden.' }
  }
  revalidatePath('/admin', 'layout')
  return { ok: true }
}
