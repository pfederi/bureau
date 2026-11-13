'use client'
import { usePathname, useSearchParams } from 'next/navigation'
import { useNavRouter } from '@/app/admin/NavProgress'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { listBusinessYears } from '@/lib/utils'

const YEARS = listBusinessYears()

/** Jahr der Auswertung; Sortierung bleibt erhalten. jahr: Jahreszahl oder 'alle'. */
export default function ReportYearFilter({ jahr }: { jahr: string }) {
  const router = useNavRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  function waehlen(v: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('jahr', v)
    router.push(`${pathname}?${params.toString()}`)
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor="auswertung-jahr">Jahr</Label>
      <Select value={jahr} onValueChange={waehlen}>
        <SelectTrigger id="auswertung-jahr" className="w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          <SelectItem value="alle">Alle Jahre</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
