import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getAdminStep, LOGIN_PATH } from '@/lib/auth'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import TotpSetup from './TotpSetup'
import PasskeySetup from './PasskeySetup'

export const metadata = { title: 'Zwei-Faktor-Anmeldung' }

async function signOut() {
  'use server'
  const supabase = await createServerSupabase()
  await supabase.auth.signOut({ scope: 'local' })
  redirect(LOGIN_PATH)
}

export default async function ZweiFaktorPage() {
  const supabase = await createServerSupabase()
  const { step } = await getAdminStep(supabase)
  if (step === 'ok') redirect('/admin')
  if (step !== 'einrichten') redirect(LOGIN_PATH)

  return (
    <main id="main" className="min-h-screen flex items-center justify-center p-4 bg-muted/40">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Zwei-Faktor-Anmeldung einrichten</CardTitle>
          <CardDescription>
            Zum Schutz der Kunden- und Rechnungsdaten braucht die Anmeldung neben dem Passwort einen Code aus einer Authenticator-App.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <TotpSetup mode="einrichten" />
          <div className="space-y-3 border-t pt-5">
            <div>
              <h2 className="text-sm font-medium">Oder mit Passkey</h2>
              <p className="text-xs text-muted-foreground">Touch ID, Face ID oder ein Sicherheitsschlüssel statt eines Codes.</p>
            </div>
            <PasskeySetup mode="einrichten" />
          </div>
          <p className="text-xs text-muted-foreground">
            Tipp: Richte danach unter Einstellungen ein zweites Gerät ein, damit du auch ohne Handy hineinkommst.
          </p>
          <form action={signOut}>
            <button type="submit" className="text-sm text-muted-foreground underline-offset-4 hover:text-blue-300 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
              Abmelden
            </button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
