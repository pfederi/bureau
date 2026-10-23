'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Fingerprint } from 'lucide-react'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { passkeyErrorText } from './totp'

/** Passkey (Touch ID, Face ID) als zweiten Faktor einrichten. */
export default function PasskeySetup({ mode, onDone, onCancel }: { mode: 'einrichten' | 'hinzufuegen'; onDone?: () => void; onCancel?: () => void }) {
  const router = useRouter()
  const [name, setName] = useState('Passkey Mac')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function register(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const supabase = createBrowserSupabase()
    // Abgebrochene Einrichtungen aufräumen, sonst ist der Name noch belegt
    const { data: list } = await supabase.auth.mfa.listFactors()
    for (const f of list?.all ?? []) {
      if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
    const { error } = await supabase.auth.mfa.webauthn.register({ friendlyName: name.trim() })
    setBusy(false)
    if (error) { setError(passkeyErrorText(error)); return }
    toast.success(`${name.trim()} eingerichtet`)
    if (mode === 'einrichten') router.push('/admin')
    router.refresh()
    onDone?.()
  }

  return (
    <form onSubmit={register} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="passkey-name">Name des Passkeys</Label>
        <Input id="passkey-name" required maxLength={40} value={name} onChange={e => setName(e.target.value)} placeholder="z. B. Passkey Mac oder iPhone" />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" aria-busy={busy} disabled={busy || !name.trim()}>
          <Fingerprint className="h-4 w-4 mr-1.5" />{busy ? 'Warte auf Bestätigung…' : 'Passkey einrichten'}
        </Button>
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Abbrechen</Button>}
      </div>
    </form>
  )
}
