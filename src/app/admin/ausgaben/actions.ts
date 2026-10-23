'use server'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { parseExpenseForm, createExpense, updateExpense, deleteExpense, listExpenses } from '@/lib/db/expenses'
import { findDuplicates, type DuplicateCandidate } from '@/lib/expenses/duplicates'
import { formatChf } from '@/lib/invoices/stats'
import { getSettings, updateSettings } from '@/lib/db/settings'
import { formatDatum } from '@/lib/utils'

type Result = { ok: boolean; error?: string }

export async function addExpenseAction(formData: FormData): Promise<Result> {
  await requireSession()
  try {
    await createExpense(parseExpenseForm(formData))
  } catch {
    return { ok: false, error: 'Ausgabe konnte nicht gespeichert werden. Bitte Eingaben prüfen.' }
  }
  revalidatePath('/admin', 'layout')
  return { ok: true }
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
