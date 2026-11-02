'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { addGuthaben, applyGuthaben, deleteGuthaben, removeGuthaben, GuthabenFehler } from '@/lib/db/guthaben'
import { bucheZahlungAufsKonto } from '@/modules/material'
import { edition } from '@/edition'
import { formatChf } from '@/lib/invoices/stats'
import { formatDatum } from '@/lib/utils'

type Result = { ok: boolean; error?: string; warnung?: string }

const ABGLEICH_WARNUNG = 'Gebucht, aber der Abgleich der Material-Rechnungen ist fehlgeschlagen. Er läuft beim nächsten Eintrag im Materialkonto erneut.'

const guthabenSchema = z.object({
  customer_id: z.uuid(),
  datum: z.iso.date(),
  betrag: z.coerce.number().positive().max(1_000_000).transform(n => Math.round(n * 100) / 100),
  beschreibung: z.string().trim().min(1).max(200),
  invoice_id: z.uuid().nullable(),
  ziel: z.enum(['guthaben', 'materialkonto']).default('guthaben'),
})

type GuthabenInput = {
  customer_id: string; datum: string; betrag: number; beschreibung: string; invoice_id: string | null
  /** materialkonto: als Zahlung aufs Materialkonto buchen statt als Guthaben für Rechnungen */
  ziel?: 'guthaben' | 'materialkonto'
}

/** Überzahlung (oder anderes Guthaben) beim Kunden erfassen. */
export async function addGuthabenAction(input: GuthabenInput): Promise<Result> {
  await requireSession()
  const parsed = guthabenSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Bitte Datum, Betrag und Beschreibung prüfen.' }
  const d = parsed.data
  if (d.ziel === 'materialkonto' && !edition.material) return { ok: false, error: 'Ungültige Eingabe.' }
  let warnung: string | undefined
  try {
    if (d.ziel === 'materialkonto') {
      const { abgeglichen } = await bucheZahlungAufsKonto({ customer_id: d.customer_id, datum: d.datum, betrag: d.betrag, beschreibung: d.beschreibung })
      if (!abgeglichen) warnung = ABGLEICH_WARNUNG
    } else {
      await addGuthaben({ customer_id: d.customer_id, datum: d.datum, betrag: d.betrag, beschreibung: d.beschreibung, invoice_id: d.invoice_id ?? null })
    }
  } catch {
    return { ok: false, error: 'Guthaben konnte nicht gespeichert werden.' }
  }
  revalidatePath('/admin', 'layout')
  return { ok: true, warnung }
}

export async function deleteGuthabenAction(id: string): Promise<Result> {
  await requireSession()
  if (!z.uuid().safeParse(id).success) return { ok: false, error: 'Ungültige Eingabe.' }
  try {
    await deleteGuthaben(id)
  } catch (e) {
    return { ok: false, error: e instanceof GuthabenFehler ? e.message : 'Löschen fehlgeschlagen.' }
  }
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

/** Noch nicht angerechnetes Guthaben als Zahlung aufs Materialkonto übertragen. */
export async function guthabenAufsKontoAction(id: string): Promise<Result> {
  await requireSession()
  if (!edition.material || !z.uuid().safeParse(id).success) return { ok: false, error: 'Ungültige Eingabe.' }
  let e
  try {
    e = await deleteGuthaben(id)
  } catch (err) {
    return { ok: false, error: err instanceof GuthabenFehler ? err.message : 'Übertrag fehlgeschlagen.' }
  }
  let abgeglichen: boolean
  try {
    ({ abgeglichen } = await bucheZahlungAufsKonto({ customer_id: e.customer_id, datum: e.datum, betrag: Number(e.betrag), beschreibung: e.beschreibung }))
  } catch {
    // Nichts gebucht: Guthaben wiederherstellen, damit nichts verloren geht
    try {
      await addGuthaben({ customer_id: e.customer_id, datum: e.datum, betrag: e.betrag, beschreibung: e.beschreibung, invoice_id: e.invoice_id })
    } catch {
      revalidatePath('/admin', 'layout')
      return { ok: false, error: `Übertrag fehlgeschlagen und das Guthaben „${e.beschreibung}“ (${formatChf(Number(e.betrag))}, ${formatDatum(e.datum)}) ist weg. Bitte neu erfassen.` }
    }
    return { ok: false, error: 'Übertrag fehlgeschlagen, das Guthaben bleibt bestehen.' }
  }
  revalidatePath('/admin', 'layout')
  return { ok: true, warnung: abgeglichen ? undefined : ABGLEICH_WARNUNG }
}

/** Verfügbares Guthaben an einer offenen Rechnung anrechnen. */
export async function applyGuthabenAction(invoiceId: string): Promise<Result & { betrag?: number }> {
  await requireSession()
  if (!z.uuid().safeParse(invoiceId).success) return { ok: false, error: 'Ungültige Eingabe.' }
  let betrag: number
  try {
    betrag = await applyGuthaben(invoiceId)
  } catch (e) {
    return { ok: false, error: e instanceof GuthabenFehler ? e.message : 'Guthaben konnte nicht angerechnet werden.' }
  }
  if (betrag <= 0) return { ok: false, error: 'Kein Guthaben verfügbar.' }
  revalidatePath('/admin', 'layout')
  return { ok: true, betrag }
}

export async function removeGuthabenAction(invoiceId: string): Promise<Result> {
  await requireSession()
  if (!z.uuid().safeParse(invoiceId).success) return { ok: false, error: 'Ungültige Eingabe.' }
  try {
    await removeGuthaben(invoiceId)
  } catch {
    return { ok: false, error: 'Anrechnung konnte nicht entfernt werden.' }
  }
  revalidatePath('/admin', 'layout')
  return { ok: true }
}
