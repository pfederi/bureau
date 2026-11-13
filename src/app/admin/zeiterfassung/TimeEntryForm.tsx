'use client'
import { markiereGespeichert } from '../Bewegung'
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
import { angezeigterSatz, vorgeschlagenerAnsatz, type Ansaetze } from '@/lib/timeEntries/rates'
import { formatChf } from '@/lib/invoices/stats'

type Initial = Partial<Pick<TimeEntry, 'customer_id' | 'datum' | 'beschreibung' | 'stunden' | 'stundensatz' | 'projekt'>>

// Eigene Komponente im DialogContent: wird bei jedem Öffnen neu gemountet, damit
// die Vorbelegung (initial) jedes Mal frisch übernommen wird.
function TimeEntryFields({ customers, ansaetze, satzFest, initial, onDone }: {
  customers: Customer[]; ansaetze: Ansaetze; satzFest: boolean; initial: Initial; onDone: () => void
}) {
  const router = useRouter()
  const [customerId, setCustomerId] = useState(initial.customer_id ?? '')
  const [busy, setBusy] = useState(false)
  const [projekt, setProjekt] = useState(initial.projekt ?? '')
  const [satz, setSatz] = useState<number>(Number(initial.stundensatz ?? ansaetze.standard))
  // Von Hand geändert (oder beim Duplizieren kopiert): Vorschläge überschreiben den Satz nicht mehr
  const [satzVonHand, setSatzVonHand] = useState(satzFest)
  const vorschlag = customerId ? vorgeschlagenerAnsatz(ansaetze, customerId, projekt).ansatz : satz
  // Ohne Änderung von Hand steht immer der aktuelle Vorschlag im Feld (auch beim Speichern per Enter)
  const angezeigt = angezeigterSatz({ satz, vonHand: satzVonHand, vorschlag })
  const merkenAnbieten = Boolean(customerId && projekt.trim() && angezeigt > 0 && Math.round(angezeigt * 100) !== Math.round(vorschlag * 100))

  async function save(formData: FormData) {
    setBusy(true)
    const r = await addTimeEntry(formData)
    setBusy(false)
    if (!r.ok) {
      toast.error(r.error ?? 'Speichern fehlgeschlagen.')
      return
    }
    toast.success('Eintrag gespeichert')
    markiereGespeichert(r.id)
    if (r.hinweis) toast.error(r.hinweis)
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
        <Input id="projekt" name="projekt" list="projekt-vorschlaege" placeholder="z. B. Relaunch 2026" value={projekt} onChange={e => setProjekt(e.target.value)} autoComplete="off" />
      </div>
      <div className="space-y-1.5 md:col-span-2"><Label htmlFor="beschreibung">Beschreibung</Label><Textarea rows={3} id="beschreibung" name="beschreibung" defaultValue={initial.beschreibung} required /></div>
      <div className="space-y-1.5"><Label htmlFor="stunden">Stunden</Label><DecimalInput id="stunden" name="stunden" defaultValue={initial.stunden} required /></div>
      <div className="space-y-1.5"><Label htmlFor="stundensatz">Stundensatz</Label><DecimalInput id="stundensatz" name="stundensatz" value={angezeigt} onValueChange={n => { setSatz(n); setSatzVonHand(true) }} /></div>
      {merkenAnbieten && (
        <label className="md:col-span-2 flex items-start gap-2 text-sm">
          <input type="checkbox" name="ansatz_merken" className="mt-0.5 h-4 w-4 rounded-sm border-input accent-primary" />
          <span>
            Als Ansatz für dieses Projekt merken
            <span className="block text-xs text-muted-foreground">Neue Einträge von «{projekt.trim()}» bei diesem Kunden bekommen dann {formatChf(angezeigt)} statt {formatChf(vorschlag)}.</span>
          </span>
        </label>
      )}
      <div className="md:col-span-2 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}><X className="h-4 w-4 mr-1.5" />Abbrechen</Button>
        <Button type="submit" disabled={busy}><Plus className="h-4 w-4 mr-1.5" />Eintrag speichern</Button>
      </div>
    </form>
  )
}

function TimeEntryDialog({ open, onOpenChange, title, description, customers, ansaetze, satzFest, initial }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; customers: Customer[]; ansaetze: Ansaetze; satzFest: boolean; initial: Initial
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <TimeEntryFields customers={customers} ansaetze={ansaetze} satzFest={satzFest} initial={initial} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

/** Knopf „Neuer Eintrag“ mit Erfassungsformular im Dialog. defaultCustomerId: aktiver Kundenfilter. */
export default function TimeEntryForm({ customers, ansaetze, today, defaultCustomerId = '' }: {
  customers: Customer[]; ansaetze: Ansaetze; today: string; defaultCustomerId?: string
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
        ansaetze={ansaetze}
        satzFest={false}
        initial={{ datum: today, customer_id: defaultCustomerId, stundensatz: defaultCustomerId ? vorgeschlagenerAnsatz(ansaetze, defaultCustomerId).ansatz : ansaetze.standard }}
      />
    </>
  )
}

/** Icon-Knopf: neuen Eintrag als Kopie anlegen (Datum = heute). */
export function DuplicateTimeEntryButton({ entry, customers, ansaetze, today }: { entry: TimeEntry; customers: Customer[]; ansaetze: Ansaetze; today: string }) {
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
        ansaetze={ansaetze}
        satzFest
        initial={{ ...entry, datum: today }}
      />
    </>
  )
}
