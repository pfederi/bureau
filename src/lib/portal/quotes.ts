import { z } from 'zod'
import type { Quote } from '@/lib/types'

export type PortalQuote = Pick<Quote, 'id' | 'offertnummer' | 'status' | 'offertdatum' | 'gueltig_bis' | 'betrag' | 'antwort_am' | 'antwort_name'>
export type OfferteZustand = 'offen' | 'abgelaufen' | 'angenommen' | 'abgelehnt'

/** Heutiges Datum in Zürcher Zeit (YYYY-MM-DD) – massgebend für «gültig bis». */
export function heuteZuerich(now: Date = new Date()): string {
  return now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' })
}

/** Tag einer Antwort (Zeitstempel) in Zürcher Zeit als «14.11.2026» – Nachweis der Zusage. */
export function antwortDatum(iso: string): string {
  return new Date(iso).toLocaleDateString('de-CH', { timeZone: 'Europe/Zurich', day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Zustand einer Offerte für den Kundenlink; Entwürfe: null (nie anzeigen). «gültig bis» zählt den ganzen Tag. */
export function offerteZustand(q: Pick<Quote, 'status' | 'gueltig_bis'>, heute: string): OfferteZustand | null {
  if (q.status === 'angenommen' || q.status === 'abgelehnt') return q.status
  if (q.status !== 'versendet') return null
  return q.gueltig_bis && q.gueltig_bis < heute ? 'abgelaufen' : 'offen'
}

const leerZuNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v)

/** Eingabe der öffentlichen Antwort-Route. */
export const antwortSchema = z.object({
  antwort: z.enum(['annehmen', 'ablehnen']),
  name: z.string().trim().min(2, 'Bitte den Namen angeben.').max(100, 'Der Name ist zu lang.'),
  grund: z.preprocess(leerZuNull, z.string().trim().max(1000, 'Der Grund ist zu lang (höchstens 1000 Zeichen).').nullable()).default(null),
  bestaetigt: z.boolean().optional(),
}).refine(a => a.antwort !== 'annehmen' || a.bestaetigt === true, { message: 'Bitte die Annahme bestätigen.', path: ['bestaetigt'] })

export type AntwortInput = z.infer<typeof antwortSchema>
