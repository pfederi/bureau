'use client'
import { useNavRouter } from '@/app/admin/NavProgress'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { listBusinessYears } from '@/lib/utils'

export default function YearSelect({ jahr }: { jahr: number }) {
  const router = useNavRouter()
  return (
    <div className="space-y-1.5">
      <Label htmlFor="abschluss-jahr">Jahr</Label>
      <Select value={String(jahr)} onValueChange={v => router.push(`/admin/ausgaben/abschluss?jahr=${v}`)}>
        <SelectTrigger id="abschluss-jahr" className="w-32"><SelectValue /></SelectTrigger>
        <SelectContent>
          {listBusinessYears().map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}
