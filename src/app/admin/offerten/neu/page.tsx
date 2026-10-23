import { listCustomers } from '@/lib/db/customers'
import { getSettings } from '@/lib/db/settings'
import QuoteForm from '../QuoteForm'

export const metadata = { title: 'Neue Offerte' }

export default async function NeueOffertePage(props: { searchParams: Promise<{ kunde?: string }> }) {
  const searchParams = await props.searchParams
  const [customers, settings] = await Promise.all([listCustomers(), getSettings()])
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Neue Offerte</h1>
        <p className="text-sm text-muted-foreground">Offerte erstellen – später mit einem Klick in eine Rechnung umwandeln.</p>
      </div>
      <QuoteForm customers={customers} mwstHinweis={settings.mwst_hinweis} today={today} defaultCustomerId={searchParams.kunde} />
    </div>
  )
}
