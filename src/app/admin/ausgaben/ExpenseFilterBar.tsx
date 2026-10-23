'use client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useNavRouter } from '@/app/admin/NavProgress'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { EXPENSE_CATEGORIES } from '@/lib/expenses/categories'
import { listBusinessYears } from '@/lib/utils'
import MobileFilter from '../MobileFilter'

const YEARS = listBusinessYears()

export default function ExpenseFilterBar({ jahr, kategorie }: { jahr: string; kategorie: string }) {
  const router = useNavRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function update(key: 'jahr' | 'kategorie', value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (key === 'kategorie' && value === 'alle') params.delete('kategorie')
    else params.set(key, value)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <MobileFilter zusammenfassung={[jahr === 'alle' ? 'Alle Jahre' : jahr, EXPENSE_CATEGORIES.find(c => c.value === kategorie)?.label ?? 'Alle Kategorien'].join(' · ')}>
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="filter-jahr">Jahr</Label>
        <Select value={jahr} onValueChange={v => update('jahr', v)}>
          <SelectTrigger id="filter-jahr" className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Jahre</SelectItem>
            {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="filter-kategorie">Kategorie</Label>
        <Select value={kategorie || 'alle'} onValueChange={v => update('kategorie', v)}>
          <SelectTrigger id="filter-kategorie" className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Kategorien</SelectItem>
            {EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
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
