'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import type { Customer, TimeEntry } from '@/lib/types'
import { updateTimeEntryAction, deleteTimeEntryAction } from './actions'

export default function TimeEntryActions({ entry, customers }: { entry: TimeEntry; customers: Customer[] }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [customerId, setCustomerId] = useState(entry.customer_id)
  const [busy, setBusy] = useState(false)

  async function save(formData: FormData) {
    setBusy(true)
    const r = await updateTimeEntryAction(entry.id, formData)
    setBusy(false)
    if (!r.ok) {
      toast.error(r.error ?? 'Speichern fehlgeschlagen.')
      return
    }
    toast.success('Eintrag aktualisiert')
    setEditOpen(false)
    router.refresh()
  }

  async function remove() {
    setBusy(true)
    const r = await deleteTimeEntryAction(entry.id)
    setBusy(false)
    if (!r.ok) {
      toast.error(r.error ?? 'Löschen fehlgeschlagen.')
      return
    }
    toast.success('Eintrag gelöscht')
    setDeleteOpen(false)
    router.refresh()
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Aktionen">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* onSelect statt sofort öffnen: Radix lässt das Dropdown erst zumachen, sonst
              bleibt document.body auf pointer-events:none hängen (Dialog-in-Dropdown-Bug). */}
          <DropdownMenuItem onSelect={() => setTimeout(() => setEditOpen(true), 0)}>
            <Pencil className="h-4 w-4 mr-2" />Bearbeiten
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setTimeout(() => setDeleteOpen(true), 0)}
          >
            <Trash2 className="h-4 w-4 mr-2" />Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Eintrag bearbeiten</DialogTitle>
            <DialogDescription>Änderungen werden sofort gespeichert.</DialogDescription>
          </DialogHeader>
          <form action={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor={`datum-${entry.id}`}>Datum</Label>
              <Input id={`datum-${entry.id}`} name="datum" type="date" defaultValue={entry.datum} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`customer-${entry.id}`}>Kunde</Label>
              <Select name="customer_id" required value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger id={`customer-${entry.id}`}><SelectValue placeholder="Kunde wählen…" /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.firma_oder_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor={`projekt-${entry.id}`}>Projekt <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id={`projekt-${entry.id}`} name="projekt" list="projekt-vorschlaege" defaultValue={entry.projekt ?? ''} autoComplete="off" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor={`beschreibung-${entry.id}`}>Beschreibung</Label>
              <Textarea rows={3} id={`beschreibung-${entry.id}`} name="beschreibung" defaultValue={entry.beschreibung} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`stunden-${entry.id}`}>Stunden</Label>
              <DecimalInput id={`stunden-${entry.id}`} name="stunden" defaultValue={entry.stunden} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`stundensatz-${entry.id}`}>Stundensatz</Label>
              <DecimalInput id={`stundensatz-${entry.id}`} name="stundensatz" defaultValue={entry.stundensatz} required />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={busy}>Speichern</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eintrag löschen?</AlertDialogTitle>
            <AlertDialogDescription>Diese Aktion kann nicht rückgängig gemacht werden.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={remove}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
