import { listCustomers } from '@/lib/db/customers'
import { CustomersManager } from './CustomersManager'

export const metadata = { title: 'Kunden' }

export default async function KundenPage() {
  const customers = await listCustomers()
  return <CustomersManager customers={customers} />
}
