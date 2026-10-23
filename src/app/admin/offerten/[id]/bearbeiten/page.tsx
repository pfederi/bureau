import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { getQuoteWithItems } from '@/lib/db/quotes'
import { listCustomers } from '@/lib/db/customers'
import QuoteForm from '../../QuoteForm'

export const metadata = { title: 'Offerte bearbeiten' }

export default async function OfferteBearbeitenPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  await requireSession()
  const { quote, items } = await getQuoteWithItems(params.id)
  if (quote.status !== 'entwurf') redirect('/admin/offerten')
  const customers = await listCustomers()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Offerte bearbeiten</h1>
        <p className="text-sm text-muted-foreground">{quote.offertnummer} – nur Entwürfe können bearbeitet werden.</p>
      </div>
      <QuoteForm
        customers={customers}
        mwstHinweis={quote.mwst_hinweis}
        today={quote.offertdatum}
        initial={{
          quoteId: quote.id,
          customerId: quote.customer_id,
          offertdatum: quote.offertdatum,
          gueltigBis: quote.gueltig_bis ?? '',
          notiz: quote.notiz ?? '',
          rabattProzent: Number(quote.rabatt_prozent ?? 0),
          rows: items.map(it => ({ bezeichnung: it.bezeichnung, menge: Number(it.menge), einheit: it.einheit, einzelpreis: Number(it.einzelpreis) })),
        }}
      />
    </div>
  )
}
