'use client'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { KeyRound } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { MIN_PASSWORD_LENGTH } from '@/lib/password'
import { changePasswordAction } from './passwordActions'

export default function PasswordForm({ email }: { email: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setBusy(true); setError(null)
    const r = await changePasswordAction(String(fd.get('aktuell') ?? ''), String(fd.get('neu') ?? ''), String(fd.get('wiederholung') ?? ''))
    setBusy(false)
    if (!r.ok) { setError(r.error ?? 'Das Passwort konnte nicht geändert werden.'); return }
    formRef.current?.reset()
    toast.success('Passwort geändert')
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      {/* Für Passwortmanager: zu welchem Konto das Passwort gehört */}
      <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
      <div className="space-y-1.5">
        <Label htmlFor="pw-aktuell">Aktuelles Passwort</Label>
        <Input id="pw-aktuell" name="aktuell" type="password" autoComplete="current-password" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pw-neu">Neues Passwort</Label>
        <Input id="pw-neu" name="neu" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required aria-describedby="pw-hinweis" />
        <p id="pw-hinweis" className="text-xs text-muted-foreground">Mindestens {MIN_PASSWORD_LENGTH} Zeichen.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pw-wiederholung">Neues Passwort wiederholen</Label>
        <Input id="pw-wiederholung" name="wiederholung" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}><KeyRound className="h-4 w-4 mr-1.5" />{busy ? 'Speichern…' : 'Passwort ändern'}</Button>
      </div>
    </form>
  )
}
