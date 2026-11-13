import { listCustomers } from '@/lib/db/customers'
import { getSettings } from '@/lib/db/settings'
import { CustomersManager } from './CustomersManager'

export const metadata = { title: 'Kunden' }

export default async function KundenPage() {
  const [customers, settings] = await Promise.all([listCustomers(), getSettings()])
  return <CustomersManager customers={customers} standardAnsatz={settings.standard_stundensatz} />
}
