'use client'
import { useState } from 'react'
import { useNavRouter } from '@/app/admin/NavProgress'
import { toast } from 'sonner'
import { Download, Send, MoreHorizontal, Pencil, Eye, Trash2, Wallet, BellRing, Ban, PiggyBank, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { setStatusAction, deleteInvoiceAction, setVerrechnungAction, stornoInvoiceAction } from './rechnungen/statusActions'
import { formatDatum } from '@/lib/utils'
import { formatChf } from '@/lib/invoices/stats'
import { anrechnungFuer, zuBezahlen } from '@/lib/invoices/guthaben'
import { applyGuthabenAction, removeGuthabenAction } from './rechnungen/guthabenActions'
import { edition } from '@/edition'
import { InvoicePreviewDialog } from './InvoicePreview'
import SendenBestaetigen from './SendenBestaetigen'
import type { InvoiceStatus } from '@/lib/types'

const statusLabel: Record<InvoiceStatus, string> = {
  entwurf: 'Entwurf', versendet: 'Versendet', bezahlt: 'Bezahlt', storniert: 'Storniert',
}
const statusOptions: InvoiceStatus[] = ['entwurf', 'versendet', 'bezahlt']

export default function InvoiceActions({
  id, rechnungsnummer, status, customerId, verrechnung, erinnertAm, email, betrag, guthabenAngerechnet = 0, guthabenVerfuegbar = 0,
}: {
  id: string; rechnungsnummer: string; status: InvoiceStatus; customerId: string; verrechnung: boolean; erinnertAm: string | null; email: string | null
  betrag: number
  /** An dieser Rechnung angerechnetes Guthaben */
  guthabenAngerechnet?: number
  /** Noch freies Guthaben des Kunden */
  guthabenVerfuegbar?: number
}) {
  const router = useNavRouter()
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [kopie, setKopie] = useState(true)

  const pdfUrl = `/api/invoices/${id}/pdf`

  async function send() {
    setBusy(true)
    const res = await fetch(`/api/invoices/${id}/send`, { method: 'POST' })
    setBusy(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Versand fehlgeschlagen')
      return
    }
    toast.success('Rechnung versendet')
    setOpen(false)
    router.refresh()
  }

  async function remind() {
    setBusy(true)
    const res = await fetch(`/api/invoices/${id}/remind`, { method: 'POST' })
    setBusy(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Erinnerung fehlgeschlagen')
      return
    }
    toast.success('Zahlungserinnerung versendet')
    setOpen(false)
    router.refresh()
  }

  async function storno() {
    setBusy(true)
    const r = await stornoInvoiceAction(id, kopie)
    setBusy(false)
    if (!r.ok) {
      toast.error(r.error ?? 'Stornieren fehlgeschlagen.')
      return
    }
    setOpen(false)
    if (r.newId) {
      toast.success('Storniert – korrigierte Kopie als Entwurf erstellt')
      router.push(`/admin/rechnungen/${r.newId}/bearbeiten`)
    } else {
      toast.success('Rechnung storniert')
      router.refresh()
    }
  }

  async function changeStatus(next: InvoiceStatus) {
    if (next === status) return
    setBusy(true)
    try {
      await setStatusAction(id, next)
      toast.success(`Status geändert zu „${statusLabel[next]}“`)
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('Status konnte nicht geändert werden.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleVerrechnung(next: boolean) {
    setBusy(true)
    const r = await setVerrechnungAction(id, next)
    setBusy(false)
    if (!r.ok) {
      toast.error(r.error ?? 'Verrechnung konnte nicht geändert werden.')
      return
    }
    toast.success(next ? 'Wird über das Kundenkonto verrechnet' : 'Wird normal bezahlt')
    router.refresh()
  }

  // Neu angerechnet wird alles Freie plus das, was schon an dieser Rechnung hängt (höchstens der Betrag)
  const neueAnrechnung = anrechnungFuer(guthabenVerfuegbar + guthabenAngerechnet, betrag)
  const offen = status === 'entwurf' || status === 'versendet'

  async function guthabenAnrechnen() {
    setBusy(true)
    const r = await applyGuthabenAction(id)
    setBusy(false)
    if (!r.ok) {
      toast.error(r.error ?? 'Guthaben konnte nicht angerechnet werden.')
      return
    }
    toast.success(`${formatChf(r.betrag ?? 0)} Guthaben angerechnet`)
    setOpen(false)
    router.refresh()
  }

  async function guthabenEntfernen() {
    setBusy(true)
    const r = await removeGuthabenAction(id)
    setBusy(false)
    if (!r.ok) {
      toast.error(r.error ?? 'Anrechnung konnte nicht entfernt werden.')
      return
    }
    toast.success('Anrechnung entfernt, das Guthaben ist wieder frei')
    setOpen(false)
    router.refresh()
  }

  async function deleteDraft() {
    setBusy(true)
    const r = await deleteInvoiceAction(id)
    setBusy(false)
    if (!r.ok) {
      toast.error(r.error ?? 'Löschen fehlgeschlagen.')
      return
    }
    toast.success('Entwurf gelöscht')
    setOpen(false)
    router.refresh()
  }

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MoreHorizontal className="h-4 w-4 sm:mr-1.5" /><span className="sr-only sm:not-sr-only">Aktionen</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rechnung {rechnungsnummer}</DialogTitle>
          <DialogDescription>Status: {statusLabel[status]}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {status === 'entwurf' && (
            <Button asChild variant="outline">
              <a href={`/admin/rechnungen/${id}/bearbeiten`}><Pencil className="h-4 w-4 mr-2" />Bearbeiten</a>
            </Button>
          )}
          {status === 'entwurf' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={busy} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />Löschen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Entwurf {rechnungsnummer} löschen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Diese Aktion kann nicht rückgängig gemacht werden. Verwendete Zeiterfassungs-Einträge werden wieder als unfakturiert markiert.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={deleteDraft}
                  >
                    Löschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="outline" onClick={() => { setOpen(false); setPreview(true) }}>
            <Eye className="h-4 w-4 mr-2" />PDF-Vorschau
          </Button>
          <Button asChild variant="outline">
            <a href={pdfUrl}><Download className="h-4 w-4 mr-2" />PDF herunterladen</a>
          </Button>
          {(status === 'entwurf' || status === 'versendet') && (
            <SendenBestaetigen
              disabled={busy}
              titel={`Rechnung ${rechnungsnummer} ${status === 'versendet' ? 'erneut ' : ''}senden?`}
              text="Die Rechnung geht als PDF"
              empfaenger={email}
              onSenden={send}
            >
              <Send className="h-4 w-4 mr-2" />{status === 'versendet' ? 'Erneut senden' : 'Senden'}
            </SendenBestaetigen>
          )}
          {status === 'versendet' && !verrechnung && (
            <SendenBestaetigen
              disabled={busy}
              titel="Zahlungserinnerung senden?"
              text={`Die Erinnerung für ${rechnungsnummer} geht mit der Rechnung im Anhang`}
              empfaenger={email}
              onSenden={remind}
            >
              <BellRing className="h-4 w-4 mr-2" />Erinnerung senden
            </SendenBestaetigen>
          )}
          {offen && !verrechnung && (guthabenAngerechnet > 0 || guthabenVerfuegbar > 0) && (
            <div className="space-y-2 rounded-md border p-3 text-sm">
              <p className="font-medium">Guthaben</p>
              {guthabenAngerechnet > 0 && (
                <p className="text-muted-foreground tabular-nums">
                  {formatChf(guthabenAngerechnet)} angerechnet, zu bezahlen {formatChf(zuBezahlen({ betrag, guthaben_angerechnet: guthabenAngerechnet }))}.
                </p>
              )}
              {guthabenVerfuegbar > 0 && neueAnrechnung > guthabenAngerechnet && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={busy} className="w-full">
                      <PiggyBank className="h-4 w-4 mr-2" />Guthaben anrechnen ({formatChf(guthabenVerfuegbar)} frei)
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Guthaben an {rechnungsnummer} anrechnen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Angerechnet werden {formatChf(neueAnrechnung)}, zu bezahlen bleiben {formatChf(zuBezahlen({ betrag, guthaben_angerechnet: neueAnrechnung }))}. Das PDF zeigt den Abzug, der QR-Zahlteil lautet auf den Rest.
                        {status === 'versendet' && (neueAnrechnung >= betrag
                          ? ' Die Rechnung ist damit ganz beglichen und gilt als bezahlt.'
                          : ' Schicke die angepasste Rechnung danach mit «Erneut senden».')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction onClick={guthabenAnrechnen}>Anrechnen</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {guthabenAngerechnet > 0 && (
                <Button variant="outline" disabled={busy} className="w-full" onClick={guthabenEntfernen}>
                  <Undo2 className="h-4 w-4 mr-2" />Anrechnung entfernen
                </Button>
              )}
            </div>
          )}
          {status === 'versendet' && erinnertAm && (
            <p className="-mt-1 text-xs text-muted-foreground">Zuletzt erinnert am {formatDatum(erinnertAm)}</p>
          )}
          {(status === 'versendet' || status === 'bezahlt') && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={busy} className="text-destructive hover:text-destructive">
                  <Ban className="h-4 w-4 mr-2" />Stornieren
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Rechnung {rechnungsnummer} stornieren?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Die Rechnung zählt danach nicht mehr zu Umsatz und MWST. Verrechnete Zeiteinträge werden wieder offen.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded-sm border-input accent-primary"
                    checked={kopie}
                    onChange={e => setKopie(e.target.checked)}
                  />
                  <span>
                    Korrigierte Kopie als Entwurf erstellen
                    <span className="block text-xs text-muted-foreground">Gleiche Positionen mit neuer Nummer; die Zeiteinträge wandern zur Kopie.</span>
                  </span>
                </label>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={storno}
                  >
                    Stornieren
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {status !== 'storniert' && (<>
          {edition.material && (
            <div className="mt-2 border-t pt-2 space-y-2">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded-sm border-input accent-primary"
                  checked={verrechnung}
                  disabled={busy}
                  onChange={e => toggleVerrechnung(e.target.checked)}
                />
                <span>Mit Material verrechnen (Kundenkonto)</span>
              </label>
              {verrechnung && (
                <Button asChild variant="outline" className="w-full">
                  <a href={`/admin/kunden/${customerId}/konto`}><Wallet className="h-4 w-4 mr-2" />Kundenkonto öffnen</a>
                </Button>
              )}
            </div>
          )}
          {/* ohne Material-Block übernimmt der Status den Abstand nach oben */}
          <div className={edition.material ? 'border-t pt-2' : 'mt-2 border-t pt-2'}>
            <label htmlFor="status-manuell" className="mb-1.5 block text-xs text-muted-foreground">Status manuell ändern</label>
            <Select value={status} disabled={busy} onValueChange={v => changeStatus(v as InvoiceStatus)}>
              <SelectTrigger id="status-manuell">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(s => (
                  <SelectItem key={s} value={s} disabled={edition.material && verrechnung && s === 'bezahlt'}>{statusLabel[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {edition.material && verrechnung && status !== 'entwurf' && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Wird über das Kundenkonto verrechnet: „Bezahlt“ wird automatisch gesetzt, sobald Material die Rechnung deckt.
              </p>
            )}
          </div>
          </>)}
        </div>
      </DialogContent>
    </Dialog>

    <InvoicePreviewDialog id={id} rechnungsnummer={rechnungsnummer} open={preview} onOpenChange={setPreview} />
    </>
  )
}
