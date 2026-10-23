'use client'
import { useState } from 'react'
import { useNavRouter } from '@/app/admin/NavProgress'
import { toast } from 'sonner'
import { Download, Send, MoreHorizontal, Pencil, Eye, ExternalLink, Trash2, FileCheck2, ThumbsUp, ThumbsDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import type { QuoteStatus } from '@/lib/types'
import { setQuoteStatusAction, deleteQuoteAction, convertQuoteAction } from './actions'
import { quoteStatusLabel } from '@/lib/quotes'


export default function QuoteActions({ id, offertnummer, status, invoiceId }: {
  id: string; offertnummer: string; status: QuoteStatus; invoiceId: string | null
}) {
  const router = useNavRouter()
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const pdfUrl = `/api/quotes/${id}/pdf`

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusy(true)
    const r = await fn()
    setBusy(false)
    if (!r.ok) {
      toast.error(r.error ?? 'Aktion fehlgeschlagen.')
      return false
    }
    toast.success(success)
    setOpen(false)
    router.refresh()
    return true
  }

  async function send() {
    await run(async () => {
      const res = await fetch(`/api/quotes/${id}/send`, { method: 'POST' })
      if (res.ok) return { ok: true }
      const d = await res.json().catch(() => ({}))
      return { ok: false, error: d.error ?? 'Versand fehlgeschlagen' }
    }, 'Offerte versendet')
  }

  async function convert() {
    setBusy(true)
    const r = await convertQuoteAction(id)
    setBusy(false)
    if (!r.ok || !r.invoiceId) {
      toast.error(r.error ?? 'Rechnung konnte nicht erstellt werden.')
      return
    }
    toast.success('Rechnungsentwurf aus der Offerte erstellt')
    router.push(`/admin/rechnungen/${r.invoiceId}/bearbeiten`)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm"><MoreHorizontal className="h-4 w-4 sm:mr-1.5" /><span className="sr-only sm:not-sr-only">Aktionen</span></Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Offerte {offertnummer}</DialogTitle>
            <DialogDescription>Status: {quoteStatusLabel[status]}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {status === 'entwurf' && (
              <Button asChild variant="outline">
                <a href={`/admin/offerten/${id}/bearbeiten`}><Pencil className="h-4 w-4 mr-2" />Bearbeiten</a>
              </Button>
            )}
            <Button variant="outline" onClick={() => { setOpen(false); setPreview(true) }}>
              <Eye className="h-4 w-4 mr-2" />PDF-Vorschau
            </Button>
            <Button asChild variant="outline">
              <a href={pdfUrl}><Download className="h-4 w-4 mr-2" />PDF herunterladen</a>
            </Button>
            <Button variant="outline" disabled={busy} onClick={send}>
              <Send className="h-4 w-4 mr-2" />{status === 'entwurf' ? 'Senden' : 'Erneut senden'}
            </Button>
            {invoiceId ? (
              <Button asChild variant="outline">
                <a href={`/admin/rechnungen?jahr=alle`}><FileCheck2 className="h-4 w-4 mr-2" />Rechnung wurde erstellt</a>
              </Button>
            ) : status !== 'abgelehnt' && (
              <Button disabled={busy} onClick={convert}>
                <FileCheck2 className="h-4 w-4 mr-2" />In Rechnung umwandeln
              </Button>
            )}
            {status === 'versendet' && (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" disabled={busy} onClick={() => run(() => setQuoteStatusAction(id, 'angenommen'), 'Als angenommen markiert')}>
                  <ThumbsUp className="h-4 w-4 mr-2" />Angenommen
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => run(() => setQuoteStatusAction(id, 'abgelehnt'), 'Als abgelehnt markiert')}>
                  <ThumbsDown className="h-4 w-4 mr-2" />Abgelehnt
                </Button>
              </div>
            )}
            {(status === 'angenommen' || status === 'abgelehnt') && !invoiceId && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => setQuoteStatusAction(id, 'versendet'), 'Zurück auf „Versendet“')}>
                Entscheid zurücksetzen
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
                    <AlertDialogTitle>Entwurf {offertnummer} löschen?</AlertDialogTitle>
                    <AlertDialogDescription>Diese Aktion kann nicht rückgängig gemacht werden.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => run(() => deleteQuoteAction(id), 'Entwurf gelöscht')}
                    >
                      Löschen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Vorschau {offertnummer}</DialogTitle>
            <DialogDescription>So sieht die Offerte als PDF aus.</DialogDescription>
          </DialogHeader>
          {preview && <iframe src={`${pdfUrl}?inline=1`} title={`Vorschau ${offertnummer}`} className="h-[70vh] w-full rounded-md border bg-muted" />}
          <div className="flex justify-end gap-2">
            <Button asChild variant="ghost">
              <a href={`${pdfUrl}?inline=1`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-2" />In neuem Tab</a>
            </Button>
            <Button asChild variant="outline">
              <a href={pdfUrl}><Download className="h-4 w-4 mr-2" />Herunterladen</a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
