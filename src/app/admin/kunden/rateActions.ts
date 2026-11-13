'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { aktuellerAnsatz, deleteProjectRate, listProjectRates, offeneFrage, setOpenEntryRates, setProjectRate } from '@/lib/db/rates'
import { openEntriesForCustomer } from '@/lib/db/timeEntries'
import { betroffeneOffene, type OffeneFrage } from '@/lib/timeEntries/rates'

const ansatzSchema = z.preprocess(v => (v === '' || v == null ? null : v), z.coerce.number().positive().nullable())

function neuLaden(customerId: string) {
  revalidatePath(`/admin/kunden/${customerId}/konto`)
  revalidatePath('/admin/zeiterfassung')
}

/** Projekt-Ansatz setzen oder (leeres Feld) entfernen; liefert die Rückfrage für offene Einträge. */
export async function setProjectRateAction(customerId: string, projekt: string, formData: FormData): Promise<{ ok: boolean; error?: string; frage?: OffeneFrage }> {
  await requireSession()
  const parsed = ansatzSchema.safeParse(formData.get('stundensatz'))
  if (!parsed.success || !projekt.trim()) return { ok: false, error: 'Bitte einen Ansatz grösser als 0 eingeben oder das Feld leeren.' }
  let alt: number
  try {
    alt = await aktuellerAnsatz(customerId, projekt)
    if (parsed.data === null) await deleteProjectRate(customerId, projekt)
    else await setProjectRate(customerId, projekt, parsed.data)
    neuLaden(customerId)
  } catch {
    return { ok: false, error: 'Ansatz konnte nicht gespeichert werden.' }
  }
  // Gespeichert ist gespeichert: scheitert nur die Rückfrage, gibt es eben keine
  const frage = await offeneFrage(customerId, projekt, alt).catch(() => null)
  return { ok: true, frage: frage ?? undefined }
}

/** Offene Einträge mit dem alten Ansatz auf den aktuellen setzen. Der Server bestimmt Einträge und neuen Satz selbst. */
export async function adjustOpenRatesAction(customerId: string, projekt: string | null, alt: number): Promise<{ ok: boolean; error?: string; angepasst?: number }> {
  await requireSession()
  if (!Number.isFinite(alt) || alt <= 0) return { ok: false, error: 'Ungültiger Ansatz.' }
  try {
    const [neu, projekte, offene] = await Promise.all([aktuellerAnsatz(customerId, projekt), listProjectRates(customerId), openEntriesForCustomer(customerId)])
    const ids = betroffeneOffene(offene, { customerId, projekt, alterAnsatz: alt, projekte }).map(e => e.id)
    const angepasst = await setOpenEntryRates(ids, neu)
    neuLaden(customerId)
    return { ok: true, angepasst }
  } catch {
    return { ok: false, error: 'Offene Einträge konnten nicht angepasst werden.' }
  }
}
