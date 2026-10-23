import { listCustomers } from '@/lib/db/customers'
import { getSettings } from '@/lib/db/settings'
import { listHostingBilled } from '@/lib/db/invoices'
import InvoiceForm from '../InvoiceForm'

export const metadata = { title: 'Neue Rechnung' }

export default async function NeueRechnungPage(props: { searchParams: Promise<{ kunde?: string }> }) {
  const searchParams = await props.searchParams
  const [customers, settings, hostingBilled] = await Promise.all([listCustomers(), getSettings(), listHostingBilled()])
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Neue Rechnung</h1>
        <p className="text-sm text-muted-foreground">Rechnung erstellen – pauschal oder nach Stundenaufwand.</p>
      </div>
      <InvoiceForm customers={customers} mwstHinweis={settings.mwst_hinweis} today={today} hostingBilled={hostingBilled} defaultCustomerId={searchParams.kunde} />
    </div>
  )
}
