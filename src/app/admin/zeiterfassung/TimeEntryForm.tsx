'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Customer, TimeEntry } from '@/lib/types'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Copy, Plus, X } from 'lucide-react'
import { addTimeEntry } from './actions'

type Initial = Partial<Pick<TimeEntry, 'customer_id' | 'datum' | 'beschreibung' | 'stunden' | 'stundensatz' | 'projekt'>>

// Eigene Komponente im DialogContent: wird bei jedem Öffnen neu gemountet, damit
// die Vorbelegung (initial) jedes Mal frisch übernommen wird.
function TimeEntryFields({ customers, initial, onDone }: { customers: Customer[]; initial: Initial; onDone: () => void }) {
  const router = useRouter()
  const [customerId, setCustomerId] = useState(initial.customer_id ?? '')
  const [busy, setBusy] = useState(false)

  async function save(formData: FormData) {
    setBusy(true)
    const r = await addTimeEntry(formData)
    setBusy(false)
    if (!r.ok) {
      toast.error(r.error ?? 'Speichern fehlgeschlagen.')
      return
    }
    toast.success('Eintrag gespeichert')
    onDone()
    router.refresh()
  }

  return (
    <form action={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-1.5"><Label htmlFor="datum">Datum</Label><Input id="datum" name="datum" type="date" defaultValue={initial.datum} required /></div>
      <div className="space-y-1.5"><Label htmlFor="customer_id">Kunde</Label>
        <Select name="customer_id" required value={customerId} onValueChange={setCustomerId}>
          <SelectTrigger id="customer_id"><SelectValue placeholder="Kunde wählen…" /></SelectTrigger>
          <SelectContent>
            {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.firma_oder_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="projekt">Projekt <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Input id="projekt" name="projekt" list="projekt-vorschlaege" placeholder="z. B. Relaunch 2026" defaultValue={initial.projekt ?? ''} autoComplete="off" />
      </div>
      <div className="space-y-1.5 md:col-span-2"><Label htmlFor="beschreibung">Beschreibung</Label><Textarea rows={3} id="beschreibung" name="beschreibung" defaultValue={initial.beschreibung} required /></div>
      <div className="space-y-1.5"><Label htmlFor="stunden">Stunden</Label><DecimalInput id="stunden" name="stunden" defaultValue={initial.stunden} required /></div>
      <div className="space-y-1.5"><Label htmlFor="stundensatz">Stundensatz</Label><DecimalInput id="stundensatz" name="stundensatz" defaultValue={initial.stundensatz} /></div>
      <div className="md:col-span-2 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}><X className="h-4 w-4 mr-1.5" />Abbrechen</Button>
        <Button type="submit" disabled={busy}><Plus className="h-4 w-4 mr-1.5" />Eintrag speichern</Button>
      </div>
    </form>
  )
}

function TimeEntryDialog({ open, onOpenChange, title, description, customers, initial }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; customers: Customer[]; initial: Initial
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <TimeEntryFields customers={customers} initial={initial} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

/** Knopf „Neuer Eintrag“ mit Erfassungsformular im Dialog. defaultCustomerId: aktiver Kundenfilter. */
export default function TimeEntryForm({ customers, defaultRate, today, defaultCustomerId = '' }: {
  customers: Customer[]; defaultRate: number; today: string; defaultCustomerId?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Neuer Eintrag</Button>
      <TimeEntryDialog
        open={open}
        onOpenChange={setOpen}
        title="Neuer Eintrag"
        description="Zeiteintrag erfassen."
        customers={customers}
        initial={{ datum: today, customer_id: defaultCustomerId, stundensatz: defaultRate }}
      />
    </>
  )
}

/** Icon-Knopf: neuen Eintrag als Kopie anlegen (Datum = heute). */
export function DuplicateTimeEntryButton({ entry, customers, today }: { entry: TimeEntry; customers: Customer[]; today: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="ghost" size="icon" title="Duplizieren" aria-label="Eintrag duplizieren" onClick={() => setOpen(true)}>
        <Copy className="h-4 w-4" />
      </Button>
      <TimeEntryDialog
        open={open}
        onOpenChange={setOpen}
        title="Eintrag duplizieren"
        description="Kopie mit heutigem Datum – bei Bedarf anpassen und speichern."
        customers={customers}
        initial={{ ...entry, datum: today }}
      />
    </>
  )
}
