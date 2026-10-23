'use client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useNavRouter } from '@/app/admin/NavProgress'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import type { Customer, InvoiceStatus } from '@/lib/types'
import { listBusinessYears } from '@/lib/utils'
import MobileFilter from '../MobileFilter'

const YEARS = listBusinessYears()
export type StatusOption = { value: string; label: string }

const INVOICE_STATUS: { value: InvoiceStatus; label: string }[] = [
  { value: 'entwurf', label: 'Entwurf' },
  { value: 'versendet', label: 'Versendet (offen)' },
  { value: 'bezahlt', label: 'Bezahlt' },
  { value: 'storniert', label: 'Storniert' },
]

export default function InvoiceFilterBar({
  customers, customerId, jahr, status, statusOptions = INVOICE_STATUS,
}: { customers: Customer[]; customerId: string; jahr: string; status: string; statusOptions?: StatusOption[] }) {
  const router = useNavRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function update(next: { kunde?: string; jahr?: string; status?: string }) {
    const params = new URLSearchParams(searchParams.toString())
    const kunde = next.kunde ?? customerId
    const nextJahr = next.jahr ?? jahr
    const nextStatus = next.status ?? status
    if (kunde && kunde !== 'alle') params.set('kunde', kunde)
    else params.delete('kunde')
    params.set('jahr', nextJahr)
    if (nextStatus && nextStatus !== 'alle') params.set('status', nextStatus)
    else params.delete('status')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <MobileFilter zusammenfassung={[customers.find(c => c.id === customerId)?.firma_oder_name ?? 'Alle Kunden', jahr === 'alle' ? 'Alle Jahre' : jahr, statusOptions.find(s => s.value === status)?.label ?? 'Alle Status'].join(' · ')}>
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="filter-kunde">Kunde</Label>
        <Select value={customerId || 'alle'} onValueChange={v => update({ kunde: v })}>
          <SelectTrigger id="filter-kunde" className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Kunden</SelectItem>
            {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.firma_oder_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="filter-jahr">Jahr</Label>
        <Select value={jahr} onValueChange={v => update({ jahr: v })}>
          <SelectTrigger id="filter-jahr" className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Jahre</SelectItem>
            {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="filter-status">Status</Label>
        <Select value={status || 'alle'} onValueChange={v => update({ status: v })}>
          <SelectTrigger id="filter-status" className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Status</SelectItem>
            {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {searchParams.toString() !== '' && (
        <Link href={pathname} className="pb-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Filter zurücksetzen
        </Link>
      )}
    </div>
    </MobileFilter>
  )
}
