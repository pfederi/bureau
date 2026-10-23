import type { QuoteStatus } from '@/lib/types'

/** Anzeige-Namen der Offertstatus (Server und Client). */
export const quoteStatusLabel: Record<QuoteStatus, string> = {
  entwurf: 'Entwurf', versendet: 'Versendet', angenommen: 'Angenommen', abgelehnt: 'Abgelehnt',
}
