'use client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { UserPlus, Save, X } from 'lucide-react'
import { addCustomer, editCustomer, deleteCustomerAction } from './actions'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import type { Customer } from '@/lib/types'

// Gemeinsam für Kundenliste und Kunden-Dashboard.

/** Kunde anlegen (editing = null) oder bearbeiten. */
export function CustomerFormDialog({ open, editing, onClose }: { open: boolean; editing: Customer | null; onClose: () => void }) {
  const router = useRouter()
  return (
      <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Kunde bearbeiten' : 'Neuer Kunde'}</DialogTitle>
            <DialogDescription>
              {editing ? `Kundennummer ${editing.kundennummer} bearbeiten.` : 'Neuen Kunden anlegen.'}
            </DialogDescription>
          </DialogHeader>
          <form
            key={editing?.id ?? 'new'}
            action={async (fd) => {
              const r = editing ? await editCustomer(editing.id, fd) : await addCustomer(fd)
              if (r.ok) {
                toast.success(editing ? 'Kunde gespeichert' : 'Kunde angelegt')
                onClose()
                router.refresh()
              } else {
                toast.error(r.error ?? 'Fehler')
              }
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="space-y-1.5"><Label htmlFor="firma_oder_name">Firma / Name</Label><Input id="firma_oder_name" name="firma_oder_name" required defaultValue={editing?.firma_oder_name ?? ''} /></div>
            <div className="space-y-1.5"><Label htmlFor="ansprechperson">Ansprechperson</Label><Input id="ansprechperson" name="ansprechperson" defaultValue={editing?.ansprechperson ?? ''} /></div>
            <div className="space-y-1.5"><Label htmlFor="adresse">Adresse</Label><Textarea id="adresse" name="adresse" rows={2} aria-describedby="adresse-hinweis" defaultValue={editing?.adresse ?? ''} /><p id="adresse-hinweis" className="text-xs text-muted-foreground">Mehrere Zeilen möglich, z. B. Abteilung oder Kostenstelle. Strasse und Nr. in die letzte Zeile.</p></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="plz">PLZ</Label><Input id="plz" name="plz" defaultValue={editing?.plz ?? ''} /></div>
              <div className="space-y-1.5"><Label htmlFor="ort">Ort</Label><Input id="ort" name="ort" defaultValue={editing?.ort ?? ''} /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="land">Land</Label><Input id="land" name="land" defaultValue={editing?.land ?? 'Schweiz'} /></div>
            <div className="space-y-1.5"><Label htmlFor="email">E-Mail</Label><Input id="email" name="email" type="email" defaultValue={editing?.email ?? ''} /></div>
            <div className="space-y-1.5">
              {/* unsichtbar: vorne, damit space-y das Eingabefeld als letztes Kind sieht */}
              <datalist id="gruss-optionen">
                <option value="Freundliche Grüsse" />
                <option value="Liebe Grüsse" />
                <option value="Herzliche Grüsse" />
                <option value="Beste Grüsse" />
              </datalist>
              <Label htmlFor="gruss">Grussformel (auf der Rechnung)</Label>
              <Input id="gruss" name="gruss" list="gruss-optionen" defaultValue={editing?.gruss ?? 'Freundliche Grüsse'} placeholder="z. B. Freundliche Grüsse" />
            </div>
            <fieldset className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
              <legend className="sr-only">Hosting</legend>
              <div className="md:col-span-2">
                <p className="text-sm font-medium">Hosting</p>
                <p className="text-sm text-muted-foreground">Monatlicher Betrag für die Jahresrechnung. Leer lassen, wenn kein Hosting.</p>
              </div>
              <div className="space-y-1.5"><Label htmlFor="hosting_text">Text auf der Rechnung</Label><Input id="hosting_text" name="hosting_text" placeholder="z. B. Webhosting & Wartung" defaultValue={editing?.hosting_text ?? ''} /></div>
              <div className="space-y-1.5"><Label htmlFor="hosting_preis_monat">Preis pro Monat (Fr.)</Label><DecimalInput id="hosting_preis_monat" name="hosting_preis_monat" defaultValue={editing?.hosting_preis_monat ?? ''} /></div>
              <div className="space-y-1.5"><Label htmlFor="hosting_ab">Aktiv ab</Label><Input id="hosting_ab" name="hosting_ab" type="month" defaultValue={editing?.hosting_ab?.slice(0, 7) ?? ''} /></div>
              <div className="space-y-1.5"><Label htmlFor="hosting_bis">Aktiv bis <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="hosting_bis" name="hosting_bis" type="month" defaultValue={editing?.hosting_bis?.slice(0, 7) ?? ''} /></div>
            </fieldset>
            <fieldset className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
              <legend className="sr-only">Stundenbudget</legend>
              <div className="md:col-span-2">
                <p className="text-sm font-medium">Stundenbudget</p>
                <p className="text-sm text-muted-foreground">Warnung im Dashboard ab 80 % und bei Überschreitung. Leer lassen, wenn kein Budget.</p>
              </div>
              <div className="space-y-1.5"><Label htmlFor="stunden_budget">Stunden</Label><DecimalInput id="stunden_budget" name="stunden_budget" defaultValue={editing?.stunden_budget ?? ''} /></div>
              <div className="space-y-1.5"><Label htmlFor="budget_zeitraum">Pro</Label>
                <Select name="budget_zeitraum" defaultValue={editing?.budget_zeitraum ?? 'monat'}>
                  <SelectTrigger id="budget_zeitraum"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monat">Monat</SelectItem>
                    <SelectItem value="jahr">Jahr</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </fieldset>
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                <X className="h-4 w-4 mr-1.5" />Abbrechen
              </Button>
              <Button type="submit">
                {editing ? <><Save className="h-4 w-4 mr-1.5" />Speichern</> : <><UserPlus className="h-4 w-4 mr-1.5" />Anlegen</>}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
  )
}

/** Kunde löschen mit Rückfrage; `onDeleted` z. B. zurück zur Kundenliste. */
export function CustomerDeleteDialog({ target, onClose, onDeleted }: {
  target: Customer | null
  onClose: () => void
  onDeleted?: () => void
}) {
  async function remove(c: Customer) {
    const r = await deleteCustomerAction(c.id)
    if (r.ok) {
      toast.success('Kunde gelöscht')
      onDeleted?.()
    } else {
      toast.error(r.error ?? 'Löschen fehlgeschlagen.')
    }
  }
  return (
      <AlertDialog open={target !== null} onOpenChange={o => { if (!o) onClose() }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kunde löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{target?.firma_oder_name}“ wird gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => target && remove(target)}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
  )
}
