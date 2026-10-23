'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { QrCode, ShieldCheck } from 'lucide-react'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { edition } from '@/edition'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

type Enrollment = { id: string; qr: string; secret: string }

/**
 * Richtet eine Authenticator-App ein: Name → QR-Code scannen → ersten Code bestätigen.
 * `einrichten`: Pflicht nach dem Login, danach geht es ins Dashboard.
 * `hinzufuegen`: weiteres Gerät aus den Einstellungen.
 */
export default function TotpSetup({ mode, onDone, onCancel }: {
  mode: 'einrichten' | 'hinzufuegen'
  onDone?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState(mode === 'einrichten' ? 'Handy' : '')
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)
  const pruefend = useRef(false)

  useEffect(() => { if (enrollment) codeRef.current?.focus() }, [enrollment])

  async function start(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const supabase = createBrowserSupabase()
    // Abgebrochene Einrichtungen aufräumen, sonst ist der Name noch belegt
    const { data: list } = await supabase.auth.mfa.listFactors()
    for (const f of list?.all ?? []) {
      if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: name.trim(),
      issuer: edition.adminTitel,
    })
    setLoading(false)
    if (error || !data) {
      setError(error?.message.includes('exists')
        ? 'Dieser Name ist schon vergeben. Bitte wähle einen anderen.'
        : 'Die Einrichtung konnte nicht gestartet werden. Bitte versuche es nochmals.')
      return
    }
    setEnrollment({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }

  // Passwortmanager füllen den Code ein und klicken sofort – nie sperren, sechs Ziffern
  // automatisch prüfen, doppelte Prüfungen abfangen (wie beim Login).
  async function verify(value: string) {
    if (!enrollment || pruefend.current) return
    if (!/^\d{6}$/.test(value)) { setError('Bitte gib den 6-stelligen Code ein.'); return }
    pruefend.current = true
    setLoading(true); setError(null)
    const { error } = await createBrowserSupabase().auth.mfa.challengeAndVerify({ factorId: enrollment.id, code: value })
    pruefend.current = false
    setLoading(false)
    if (error) { setError('Der Code stimmt nicht. Prüfe die Uhrzeit des Geräts und gib den aktuellen Code ein.'); setCode(''); return }
    toast.success(mode === 'einrichten' ? 'Zwei-Faktor-Anmeldung eingerichtet' : `${name.trim()} hinzugefügt`)
    if (mode === 'einrichten') router.push('/admin')
    router.refresh()
    onDone?.()
  }

  if (!enrollment) {
    return (
      <form onSubmit={start} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="totp-name">Name des Geräts</Label>
          <Input id="totp-name" required maxLength={40} value={name} onChange={e => setName(e.target.value)} placeholder="z. B. Handy oder Passwortmanager" aria-describedby="totp-name-hinweis" />
          <p id="totp-name-hinweis" className="text-xs text-muted-foreground">Damit du die Geräte später auseinanderhältst.</p>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={loading || !name.trim()}>
            <QrCode className="h-4 w-4 mr-1.5" />{loading ? 'Einen Moment…' : 'QR-Code anzeigen'}
          </Button>
          {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Abbrechen</Button>}
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={e => { e.preventDefault(); verify(code) }} className="space-y-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Öffne deine Authenticator-App, zum Beispiel 1Password, Google Authenticator oder Authy.</li>
        <li>Scanne den QR-Code oder gib den Schlüssel von Hand ein.</li>
        <li>Gib den 6-stelligen Code ein, den die App anzeigt.</li>
      </ol>
      <div className="flex flex-wrap items-start gap-4">
        {/* QR-Code braucht hellen Hintergrund, damit Kameras ihn lesen */}
        <div className="rounded-md bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrollment.qr} alt="QR-Code für die Authenticator-App" width={176} height={176} className="h-44 w-44" />
        </div>
        <div className="min-w-0 space-y-1">
          <div className="text-xs text-muted-foreground">Schlüssel zum Eintippen</div>
          <code className="block break-all rounded bg-muted px-2 py-1 font-mono text-sm">{enrollment.secret}</code>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="totp-code">Code</Label>
        <Input
          ref={codeRef}
          id="totp-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={e => {
            const value = e.target.value.replace(/\D/g, '').slice(0, 6)
            setCode(value)
            if (value.length === 6) verify(value)
          }}
          aria-describedby={error ? 'totp-fehler' : undefined}
          className="max-w-48 text-center text-lg tracking-[0.5em]"
        />
      </div>
      {error && <p id="totp-fehler" role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" aria-busy={loading}>
          <ShieldCheck className="h-4 w-4 mr-1.5" />{loading ? 'Prüfen…' : 'Bestätigen'}
        </Button>
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Abbrechen</Button>}
      </div>
    </form>
  )
}
