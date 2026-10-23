'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Fingerprint, Plus, Smartphone, Trash2 } from 'lucide-react'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { formatDatum } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import TotpSetup from '../zwei-faktor/TotpSetup'
import PasskeySetup from '../zwei-faktor/PasskeySetup'

export type DeviceFactor = { id: string; name: string; created_at: string; typ?: 'totp' | 'webauthn' }

export default function TwoFactorSettings({ factors }: { factors: DeviceFactor[] }) {
  const router = useRouter()
  const [adding, setAdding] = useState<null | 'app' | 'passkey'>(null)
  const [removeTarget, setRemoveTarget] = useState<DeviceFactor | null>(null)

  async function remove(f: DeviceFactor) {
    const { error } = await createBrowserSupabase().auth.mfa.unenroll({ factorId: f.id })
    if (error) { toast.error('Das Gerät konnte nicht entfernt werden.'); return }
    toast.success(`${f.name} entfernt`)
    router.refresh()
  }

  const last = factors.length <= 1
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border rounded-md border">
        {factors.map(f => (
          <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
            {f.typ === 'webauthn'
              ? <Fingerprint className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              : <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{f.name}</div>
              <div className="text-xs text-muted-foreground">{f.typ === 'webauthn' ? 'Passkey' : 'Authenticator-App'} · eingerichtet am {formatDatum(f.created_at.slice(0, 10))}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              disabled={last}
              title={last ? 'Das letzte Gerät lässt sich nicht entfernen' : undefined}
              aria-label={`${f.name} entfernen`}
              onClick={() => setRemoveTarget(f)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
      {last && (
        <p className="text-xs text-muted-foreground">
          Richte ein zweites Gerät ein, zum Beispiel deinen Passwortmanager. Sonst kommst du ohne Handy nicht mehr hinein.
        </p>
      )}

      {adding === 'app' && <TotpSetup mode="hinzufuegen" onDone={() => setAdding(null)} onCancel={() => setAdding(null)} />}
      {adding === 'passkey' && <PasskeySetup mode="hinzufuegen" onDone={() => setAdding(null)} onCancel={() => setAdding(null)} />}
      {adding === null && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAdding('passkey')}><Fingerprint className="h-4 w-4 mr-1.5" />Passkey hinzufügen</Button>
          <Button variant="outline" onClick={() => setAdding('app')}><Plus className="h-4 w-4 mr-1.5" />Authenticator-App hinzufügen</Button>
        </div>
      )}

      <AlertDialog open={removeTarget !== null} onOpenChange={open => { if (!open) setRemoveTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerät entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              Mit „{removeTarget?.name}“ kannst du dich danach nicht mehr anmelden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeTarget && remove(removeTarget)}
            >
              Entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
