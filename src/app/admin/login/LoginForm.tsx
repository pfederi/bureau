'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { edition } from '@/edition'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Fingerprint, LogIn, ShieldCheck } from 'lucide-react'
import { factorKinds, verifyPasskey, verifyTotp } from '../zwei-faktor/totp'

type Step = 'passwort' | 'code' | 'kein-zugriff'

export default function LoginForm({ initialStep = 'passwort', hinweis }: { initialStep?: Step; hinweis?: string }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(initialStep)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)
  const pruefend = useRef(false)
  // Welche zweiten Faktoren es gibt: Passkey (Touch ID/Face ID) und/oder Authenticator-App
  // null, solange unbekannt: dann noch kein Code-Feld, sonst füllt 1Password den Code vorschnell ein
  const [arten, setArten] = useState<{ passkey: boolean; totp: boolean } | null>(null)
  // Code-Feld erst zeigen, wenn kein Passkey da ist, er nicht klappt oder du es willst
  const [codeSichtbar, setCodeSichtbar] = useState(false)
  const passkeyGestartet = useRef(false)

  useEffect(() => {
    if (step !== 'code') return
    factorKinds(createBrowserSupabase())
      .then(k => {
        setArten(k)
        // Passkeys gelten nur für ihre Domain: lokal mit App direkt den Code nehmen
        const lokal = ['localhost', '127.0.0.1'].includes(window.location.hostname)
        if (k.passkey && !(lokal && k.totp) && !passkeyGestartet.current) {
          // Gleich starten, damit 1Password bzw. Touch ID sofort fragt; ohne Klick
          // blockiert manche Browser – dann bleibt der Knopf (ohne Fehlermeldung).
          passkeyGestartet.current = true
          void mitPasskey(k, true)
        } else {
          setCodeSichtbar(k.totp)
        }
      })
      .catch(() => { setArten({ passkey: false, totp: true }); setCodeSichtbar(true) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // Fokus auf das Code-Feld, sobald es erscheint
  useEffect(() => { if (codeSichtbar) codeRef.current?.focus() }, [codeSichtbar])

  async function mitPasskey(k = arten, automatisch = false) {
    setLoading(true); setError(null)
    const ok = await verifyPasskey(createBrowserSupabase())
    setLoading(false)
    if (!ok) {
      // Ausweichen auf den Code, falls eingerichtet
      if (k?.totp) setCodeSichtbar(true)
      if (!automatisch) setError(k?.totp ? 'Passkey nicht bestätigt. Gib den Code aus der Authenticator-App ein.' : 'Passkey nicht bestätigt. Bitte nochmals versuchen.')
      return
    }
    weiter()
  }

  function weiter() {
    router.push('/admin'); router.refresh()
  }

  async function onPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const supabase = createBrowserSupabase()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setLoading(false); setError('Login fehlgeschlagen. Bitte prüfe deine Angaben.'); return }
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    setLoading(false)
    if (data?.nextLevel === 'aal2' && data.currentLevel !== 'aal2') { setPassword(''); setStep('code'); return }
    // ohne eingerichteten Faktor leitet die Middleware zur Einrichtung weiter
    weiter()
  }

  // Passwortmanager (z. B. 1Password) füllen den Code ein und klicken sofort einen Knopf –
  // darum nie gesperrt, sechs Ziffern automatisch prüfen und doppelte Prüfungen abfangen.
  async function pruefen(value: string) {
    if (pruefend.current) return
    if (!/^\d{6}$/.test(value)) { setError('Bitte gib den 6-stelligen Code ein.'); return }
    pruefend.current = true
    setLoading(true); setError(null)
    const ok = await verifyTotp(createBrowserSupabase(), value)
    pruefend.current = false
    setLoading(false)
    if (!ok) { setError('Der Code stimmt nicht oder ist abgelaufen. Bitte gib den aktuellen Code ein.'); setCode(''); return }
    weiter()
  }

  function onCodeChange(raw: string) {
    const value = raw.replace(/\D/g, '').slice(0, 6)
    setCode(value)
    if (value.length === 6) pruefen(value)
  }

  async function abmelden() {
    await createBrowserSupabase().auth.signOut({ scope: 'local' })
    setError(null); setCode(''); setStep('passwort'); router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={edition.logo} alt={edition.name} width={48} height={48} className="mb-2 h-12 w-12 rounded-lg ring-1 ring-slate-600" />
          <CardTitle>{step === 'code' ? 'Bestätigungscode' : 'Admin-Login'}</CardTitle>
          <CardDescription>
            {step === 'code'
              ? 'Gib den 6-stelligen Code aus deiner Authenticator-App ein.'
              : step === 'kein-zugriff'
                ? 'Dieses Konto hat keinen Zugriff auf den Admin-Bereich.'
                : 'Bitte melde dich an.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'passwort' && hinweis && (
            <p role="status" className="mb-4 rounded-md border border-blue-300/30 bg-blue-300/10 px-3 py-2 text-sm">{hinweis}</p>
          )}
          {step === 'passwort' && (
            <form onSubmit={onPassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-Mail</Label>
                <Input id="email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Passwort</Label>
                <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">
                <LogIn className="h-4 w-4 mr-1.5" />
                {loading ? 'Anmelden…' : 'Anmelden'}
              </Button>
            </form>
          )}

          {step === 'code' && (
            <>
            {arten === null && <p className="text-sm text-muted-foreground" aria-live="polite">Einen Moment…</p>}
            {/* ausserhalb des Code-Formulars, damit Autofill ihn nicht auslöst */}
            {arten?.passkey && (
              <div className="mb-4 space-y-3">
                <Button type="button" className="w-full" aria-busy={loading} onClick={() => void mitPasskey()}>
                  <Fingerprint className="h-4 w-4 mr-1.5" />Mit Passkey bestätigen
                </Button>
                {arten.totp && !codeSichtbar && (
                  <p className="text-center text-xs text-muted-foreground">
                    <button type="button" onClick={() => setCodeSichtbar(true)} className="rounded-sm text-blue-300 underline-offset-4 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
                      Stattdessen Code eingeben
                    </button>
                  </p>
                )}
                {arten.totp && codeSichtbar && <p className="text-center text-xs text-muted-foreground">oder Code aus der Authenticator-App</p>}
                {/* Passkeys gelten nur für die Domain, auf der sie eingerichtet wurden (z. B. nicht lokal) */}
                {!arten.totp && typeof window !== 'undefined' && edition.domain && window.location.hostname !== edition.domain && (
                  <p className="text-xs text-muted-foreground">
                    Passkeys gelten nur auf der Domain, auf der du sie eingerichtet hast. Hier ({window.location.hostname}) brauchst du einen eigenen Passkey oder die Authenticator-App – einrichten unter Einstellungen auf {edition.domain}.
                  </p>
                )}
                {!arten.totp && error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              </div>
            )}
            {arten?.totp && codeSichtbar && (
            <form onSubmit={e => { e.preventDefault(); pruefen(code) }} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="code">Code</Label>
                <Input
                  ref={codeRef}
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={e => onCodeChange(e.target.value)}
                  aria-describedby={error ? 'code-fehler' : undefined}
                  className="text-center text-lg tracking-[0.5em]"
                />
              </div>
              {error && <p id="code-fehler" role="alert" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" aria-busy={loading} className="w-full">
                <ShieldCheck className="h-4 w-4 mr-1.5" />
                {loading ? 'Prüfen…' : 'Bestätigen'}
              </Button>
            </form>
            )}
            {/* bewusst ausserhalb des Formulars, damit Autofill ihn nicht als Absende-Knopf erwischt */}
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Falsches Konto?{' '}
              <button type="button" onClick={abmelden} className="rounded-sm text-blue-300 underline-offset-4 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
                Abmelden
              </button>
            </p>
            </>
          )}

          {step === 'kein-zugriff' && (
            <Button type="button" variant="outline" className="w-full" onClick={abmelden}>
              Abmelden
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
