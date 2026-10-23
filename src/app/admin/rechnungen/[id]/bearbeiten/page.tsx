import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { getInvoiceWithItems, listHostingBilled } from '@/lib/db/invoices'
import { listCustomers } from '@/lib/db/customers'
import InvoiceForm from '../../InvoiceForm'

export const metadata = { title: 'Rechnung bearbeiten' }

export default async function RechnungBearbeitenPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  await requireSession()
  const { invoice, items } = await getInvoiceWithItems(params.id)
  if (invoice.status !== 'entwurf') redirect('/admin')
  const [customers, hostingBilled] = await Promise.all([listCustomers(), listHostingBilled()])
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
          rows,
        }}
      />
    </div>
  )
}
