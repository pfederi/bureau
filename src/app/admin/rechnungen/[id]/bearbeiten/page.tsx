import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { getInvoiceWithItems, listHostingBilled } from '@/lib/db/invoices'
import { listCustomers } from '@/lib/db/customers'
import { listGuthabenSaldi } from '@/lib/db/guthaben'
import { angerechnet } from '@/lib/invoices/guthaben'
import InvoiceForm from '../../InvoiceForm'

export const metadata = { title: 'Rechnung bearbeiten' }

export default async function RechnungBearbeitenPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  await requireSession()
  const { invoice, items } = await getInvoiceWithItems(params.id)
  if (invoice.status !== 'entwurf') redirect('/admin')
  const [customers, hostingBilled, saldi] = await Promise.all([listCustomers(), listHostingBilled(), listGuthabenSaldi()])
  // Was dieser Entwurf schon angerechnet hat, steht ihm beim Neuberechnen wieder zur Verfügung
  const guthaben = { ...saldi, [invoice.customer_id]: (saldi[invoice.customer_id] ?? 0) + angerechnet(invoice) }
  const rows = items.map(it => ({ bezeichnung: it.bezeichnung, menge: Number(it.menge), einheit: it.einheit, einzelpreis: Number(it.einzelpreis) }))
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Rechnung bearbeiten</h1>
        <p className="text-sm text-muted-foreground">{invoice.rechnungsnummer} – nur Entwürfe können bearbeitet werden.</p>
      </div>
      <InvoiceForm
        customers={customers}
        mwstHinweis={invoice.mwst_hinweis}
        today={invoice.rechnungsdatum}
        hostingBilled={hostingBilled}
        guthaben={guthaben}
        initial={{
          invoiceId: invoice.id,
          customerId: invoice.customer_id,
          typ: invoice.typ,
          rechnungsdatum: invoice.rechnungsdatum,
          leistungsdatum: invoice.leistungsdatum ?? '',
          notiz: invoice.notiz ?? '',
          rabattProzent: Number(invoice.rabatt_prozent ?? 0),
          hostingJahr: invoice.hosting_jahr ?? null,
          verrechnungMaterial: invoice.verrechnung_material ?? false,
          guthabenAngerechnet: angerechnet(invoice),
          rows,
        }}
      />
    </div>
  )
}
