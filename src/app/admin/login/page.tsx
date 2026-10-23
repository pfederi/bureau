import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getAdminStep, MFA_SETUP_PATH } from '@/lib/auth'
import LoginForm from './LoginForm'

export const metadata = { title: 'Anmelden' }

// Hinweis nach der automatischen Abmeldung (SitzungsWaechter bzw. Proxy)
const HINWEISE: Record<string, string> = {
  inaktiv: 'Du wurdest nach 15 Minuten ohne Aktivität abgemeldet.',
  abgemeldet: 'Deine Sitzung ist abgelaufen, weil die Seite geschlossen oder länger nicht benutzt wurde.',
}

export default async function LoginPage(props: { searchParams: Promise<{ grund?: string }> }) {
  const { grund } = await props.searchParams
  const supabase = await createServerSupabase()
  const { step } = await getAdminStep(supabase)
  if (step === 'ok') redirect('/admin')
  if (step === 'einrichten') redirect(MFA_SETUP_PATH)
  return <LoginForm hinweis={HINWEISE[grund ?? '']} initialStep={step === 'code' ? 'code' : step === 'kein-zugriff' ? 'kein-zugriff' : 'passwort'} />
}
