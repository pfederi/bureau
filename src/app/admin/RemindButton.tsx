'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BellRing, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle,
  AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { HAEKCHEN } from './useBestaetigung'

/** Zahlungserinnerung direkt aus dem Dashboard – mit Rückfrage, weil eine E-Mail an den Kunden geht. */
export default function RemindButton({ invoiceId, rechnungsnummer, email }: { invoiceId: string; rechnungsnummer: string; email: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [erinnert, setErinnert] = useState(false)

  async function send() {
    setBusy(true)
    const res = await fetch(`/api/invoices/${invoiceId}/remind`, { method: 'POST' })
    setBusy(false)
    setOpen(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Erinnerung fehlgeschlagen')
      return
    }
    toast.success(`Zahlungserinnerung für ${rechnungsnummer} versendet`)
    // Häkchen kurz zeigen, dann aktualisieren (danach entfällt der Knopf für 14 Tage)
    setErinnert(true)
    setTimeout(() => router.refresh(), 900)
  }

  return (
    <>
      <Button size="sm" variant="outline" disabled={busy || erinnert} onClick={() => setOpen(true)}>
        {erinnert
          ? <><Check key="ok" className={`h-4 w-4 mr-1.5 ${HAEKCHEN}`} />Erinnert</>
          : <><BellRing className="h-4 w-4 mr-1.5" />Erinnern</>}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zahlungserinnerung senden?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Erinnerung für {rechnungsnummer} geht mit der Rechnung im Anhang an {email}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={e => { e.preventDefault(); void send() }}>
              {busy ? 'Senden…' : 'Senden'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
