'use client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useNavRouter } from '@/app/admin/NavProgress'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import type { Customer } from '@/lib/types'
import type { TimeEntryStatusFilter } from '@/lib/db/timeEntries'
import { listBusinessYears } from '@/lib/utils'
import MobileFilter from '../MobileFilter'

const YEARS = listBusinessYears()
const STATUS: { value: TimeEntryStatusFilter; label: string }[] = [
  { value: 'offen', label: 'Offen' },
  { value: 'verrechnet', label: 'Verrechnet' },
  { value: 'alle', label: 'Alle' },
]

/** jahr: '' = alle Jahre. */
export default function TimeEntryFilterBar({
  status, customers, customerId, jahr,
}: { status: TimeEntryStatusFilter; customers: Customer[]; customerId: string; jahr: string }) {
  const router = useNavRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function update(next: { status?: string; kunde?: string; jahr?: string }) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('tab') // alter Parameter aus der Tab-Ansicht
    params.set('status', next.status ?? status)
    const kunde = next.kunde ?? customerId
    if (kunde && kunde !== 'alle') params.set('kunde', kunde)
    else params.delete('kunde')
    // Beim Statuswechsel das Jahr auf den Standard des neuen Status zurücksetzen.
    const nextJahr = next.status ? undefined : (next.jahr ?? jahr)
    if (nextJahr === undefined) params.delete('jahr')
    else params.set('jahr', nextJahr || 'alle')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <MobileFilter zusammenfassung={[customers.find(c => c.id === customerId)?.firma_oder_name ?? 'Alle Kunden', jahr || 'Alle Jahre', STATUS.find(s => s.value === status)?.label ?? status].join(' · ')}>
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
        <Select value={jahr || 'alle'} onValueChange={v => update({ jahr: v === 'alle' ? '' : v })}>
          <SelectTrigger id="filter-jahr" className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Jahre</SelectItem>
            {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="filter-status">Status</Label>
        <Select value={status} onValueChange={v => update({ status: v })}>
          <SelectTrigger id="filter-status" className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
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
