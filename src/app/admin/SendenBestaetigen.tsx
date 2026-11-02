'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'

/**
 * Knopf mit Rückfrage für alles, was eine E-Mail an den Kunden schickt (Rechnung, Offerte,
 * Erinnerung). Bleibt offen, bis der Versand fertig ist.
 */
export default function SendenBestaetigen({ children, titel, empfaenger, text, disabled, onSenden }: {
  children: React.ReactNode
  titel: string
  empfaenger: string | null
  text: string
  disabled?: boolean
  onSenden: () => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function senden() {
    setBusy(true)
    await onSenden()
    setBusy(false)
    setOpen(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={o => { if (!busy) setOpen(o) }}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>{children}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titel}</AlertDialogTitle>
          <AlertDialogDescription>
            {empfaenger
              ? <>{text} an <strong className="font-medium text-foreground">{empfaenger}</strong>.</>
              : 'Beim Kunden ist keine E-Mail-Adresse hinterlegt.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction disabled={busy || !empfaenger} onClick={e => { e.preventDefault(); void senden() }}>
            {busy ? 'Senden…' : 'Senden'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
