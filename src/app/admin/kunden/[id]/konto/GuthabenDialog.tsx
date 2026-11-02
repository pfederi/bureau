'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowRightLeft, PiggyBank, Plus, Trash2, X } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { addGuthabenAction, deleteGuthabenAction, guthabenAufsKontoAction } from '@/app/admin/rechnungen/guthabenActions'
import { formatChf } from '@/lib/invoices/stats'

const KEINE = 'keine'
type Ziel = 'guthaben' | 'materialkonto'

/** Knopf mit Dialog: Überzahlung (oder anderes Guthaben) beim Kunden erfassen. */
export default function GuthabenDialog({ customerId, today, rechnungen, materialkonto }: {
  customerId: string
  today: string
  /** Versendete und bezahlte Rechnungen, neueste zuerst – zur Auswahl der überzahlten Rechnung */
  rechnungen: { id: string; rechnungsnummer: string }[]
  /** Nur bei Kunden mit Material-Verrechnung: offener Betrag im Materialkonto */
  materialkonto?: { offen: number }
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [datum, setDatum] = useState(today)
  const [betrag, setBetrag] = useState(0)
  const [rechnung, setRechnung] = useState(KEINE)
  const [beschreibung, setBeschreibung] = useState('')
  // Beschreibung folgt der gewählten Rechnung, bis sie von Hand geändert wird
  const [eigeneBeschreibung, setEigeneBeschreibung] = useState(false)
  // Bei offenem Materialkonto wird die Überzahlung meist dort abgezogen
  const standardZiel: Ziel = materialkonto && materialkonto.offen > 0 ? 'materialkonto' : 'guthaben'
  const [ziel, setZiel] = useState<Ziel>(standardZiel)
  const aufsKonto = !!materialkonto && ziel === 'materialkonto'

  function oeffnen() {
    setDatum(today); setBetrag(0); setRechnung(KEINE); setBeschreibung('Überzahlung'); setEigeneBeschreibung(false); setZiel(standardZiel)
    setOpen(true)
  }

  function rechnungWaehlen(id: string) {
    setRechnung(id)
    if (!eigeneBeschreibung) {
      const nr = rechnungen.find(r => r.id === id)?.rechnungsnummer
      setBeschreibung(nr ? `Überzahlung ${nr}` : 'Überzahlung')
    }
  }

  async function speichern(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const r = await addGuthabenAction({
      customer_id: customerId, datum, betrag, beschreibung, invoice_id: rechnung === KEINE ? null : rechnung,
      ziel: aufsKonto ? 'materialkonto' : 'guthaben',
    })
    setBusy(false)
    if (!r.ok) {
      toast.error(r.error ?? 'Speichern fehlgeschlagen.')
      return
    }
    if (r.warnung) toast.warning(r.warnung)
    else toast.success(aufsKonto ? 'Aufs Materialkonto gebucht' : 'Guthaben erfasst')
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={oeffnen}>
        <PiggyBank className="h-4 w-4 mr-1.5" />Überzahlung erfassen
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Überzahlung erfassen</DialogTitle>
            <DialogDescription>
              {aufsKonto
                ? 'Der zu viel bezahlte Betrag wird als Zahlung ins Materialkonto gebucht und vom offenen Betrag abgezogen, statt ihn zurückzuzahlen.'
                : 'Der zu viel bezahlte Betrag wird zum Guthaben des Kunden. Du rechnest es an der nächsten oder einer offenen Rechnung an, statt es zurückzuzahlen.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={speichern} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="guthaben-datum">Zahlungseingang</Label>
              <Input id="guthaben-datum" type="date" value={datum} onChange={e => setDatum(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guthaben-betrag">Zu viel bezahlt (Fr.)</Label>
              <DecimalInput id="guthaben-betrag" value={betrag} onValueChange={setBetrag} required />
            </div>
            {materialkonto && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="guthaben-ziel">Abziehen von</Label>
                <Select value={ziel} onValueChange={v => setZiel(v as Ziel)}>
                  <SelectTrigger id="guthaben-ziel"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="materialkonto">Materialkonto (offen {formatChf(materialkonto.offen)})</SelectItem>
                    <SelectItem value="guthaben">Einer Rechnung (als Guthaben anrechnen)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="guthaben-rechnung">Überzahlte Rechnung</Label>
              <Select value={rechnung} onValueChange={rechnungWaehlen}>
                <SelectTrigger id="guthaben-rechnung"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEINE}>Keine bestimmte Rechnung</SelectItem>
                  {rechnungen.map(r => <SelectItem key={r.id} value={r.id}>{r.rechnungsnummer}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="guthaben-beschreibung">Beschreibung</Label>
              <Input
                id="guthaben-beschreibung" value={beschreibung} maxLength={200} required
                aria-describedby="guthaben-beschreibung-hinweis"
                onChange={e => { setBeschreibung(e.target.value); setEigeneBeschreibung(true) }}
              />
              <p id="guthaben-beschreibung-hinweis" className="text-xs text-muted-foreground">
                {aufsKonto ? 'Steht als Zahlung im Materialkonto, auch auf der Kundenseite.' : 'Steht auf der Rechnung, an der das Guthaben angerechnet wird.'}
              </p>
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}><X className="h-4 w-4 mr-1.5" />Abbrechen</Button>
              <Button type="submit" disabled={busy || betrag <= 0}><Plus className="h-4 w-4 mr-1.5" />{aufsKonto ? 'Aufs Materialkonto buchen' : 'Guthaben speichern'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Löschknopf für einen Guthaben-Eintrag (geht nur, solange er nicht angerechnet ist). */
export function GuthabenLoeschen({ id, beschreibung }: { id: string; beschreibung: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function loeschen() {
    setBusy(true)
    const r = await deleteGuthabenAction(id)
    setBusy(false)
    if (!r.ok) {
      toast.error(r.error ?? 'Löschen fehlgeschlagen.')
      return
    }
    toast.success('Guthaben gelöscht')
    router.refresh()
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy} aria-label={`„${beschreibung}“ löschen`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>„{beschreibung}“ löschen?</AlertDialogTitle>
          <AlertDialogDescription>Das Guthaben verschwindet beim Kunden. Ist es schon an einer Rechnung angerechnet, entferne zuerst die Anrechnung.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={loeschen}>Löschen</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Überträgt ein noch nicht angerechnetes Guthaben als Zahlung aufs Materialkonto. */
export function GuthabenAufsKonto({ id, beschreibung, betrag }: { id: string; beschreibung: string; betrag: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function uebertragen() {
    setBusy(true)
    const r = await guthabenAufsKontoAction(id)
    setBusy(false)
    if (!r.ok) {
      toast.error(r.error ?? 'Übertrag fehlgeschlagen.')
      return
    }
    if (r.warnung) toast.warning(r.warnung)
    else toast.success('Aufs Materialkonto übertragen')
    router.refresh()
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy} aria-label={`„${beschreibung}“ aufs Materialkonto übertragen`}>
          <ArrowRightLeft className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Aufs Materialkonto übertragen?</AlertDialogTitle>
          <AlertDialogDescription>
            „{beschreibung}“ ({formatChf(betrag)}) wird als Zahlung ins Materialkonto gebucht und vom offenen Betrag abgezogen. Als Guthaben für Rechnungen steht es danach nicht mehr zur Verfügung.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={uebertragen}>Übertragen</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
