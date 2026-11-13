'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { formatChf } from '@/lib/invoices/stats'
import { adjustOpenRatesAction } from './rateActions'
import type { OffeneFrage } from '@/lib/timeEntries/rates'

/** Nach einer Änderung des Ansatzes: offene Einträge mit dem alten Satz anpassen? */
export function OffeneAnpassenDialog({ frage, onClose }: { frage: OffeneFrage | null; onClose: () => void }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const eins = frage?.anzahl === 1

  async function anpassen() {
    if (!frage) return
    setBusy(true)
    const r = await adjustOpenRatesAction(frage.customerId, frage.projekt, frage.alt)
    setBusy(false)
    onClose()
    if (!r.ok) { toast.error(r.error ?? 'Anpassen fehlgeschlagen.'); return }
    toast.success(r.angepasst === 1 ? '1 Eintrag angepasst' : `${r.angepasst ?? 0} Einträge angepasst`)
    router.refresh()
  }

  return (
    <AlertDialog open={frage !== null} onOpenChange={o => { if (!o) onClose() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Offene Einträge anpassen?</AlertDialogTitle>
          <AlertDialogDescription>
            {frage && <>
              {eins ? '1 offener Eintrag hat' : `${frage.anzahl} offene Einträge haben`} noch {formatChf(frage.alt)}
              {frage.projekt ? ` (Projekt «${frage.projekt}»)` : ''}. Auf {formatChf(frage.neu)} anpassen? Verrechnete Einträge bleiben unverändert.
            </>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Nur für neue Einträge</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={e => { e.preventDefault(); void anpassen() }}>Anpassen</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
