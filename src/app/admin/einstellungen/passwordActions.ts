'use server'
import { createClient } from '@supabase/supabase-js'
import { requireSession } from '@/lib/auth'
import { createServerSupabase } from '@/lib/supabase/server'
import { validateNewPassword } from '@/lib/password'

type Result = { ok: boolean; error?: string }

/** Prüft das aktuelle Passwort mit einer Wegwerf-Anmeldung, ohne die eigene Session (mit 2FA) anzutasten. */
async function currentPasswordOk(email: string, password: string): Promise<boolean> {
  const probe = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await probe.auth.signInWithPassword({ email, password })
  if (error) return false
  await probe.auth.signOut({ scope: 'local' }) // nur diese Prüf-Session beenden
  return true
}

export async function changePasswordAction(aktuell: string, neu: string, wiederholung: string): Promise<Result> {
  await requireSession()
  const fehler = validateNewPassword(aktuell, neu, wiederholung)
  if (fehler) return { ok: false, error: fehler }

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { ok: false, error: 'Benutzer nicht gefunden.' }
  if (!(await currentPasswordOk(user.email, aktuell))) return { ok: false, error: 'Das aktuelle Passwort stimmt nicht.' }

  const { error } = await supabase.auth.updateUser({ password: neu })
  if (error) {
    if (error.code === 'weak_password') return { ok: false, error: 'Das neue Passwort ist zu schwach. Bitte wähle ein längeres.' }
    if (error.code === 'same_password') return { ok: false, error: 'Das neue Passwort muss sich vom aktuellen unterscheiden.' }
    return { ok: false, error: 'Das Passwort konnte nicht geändert werden.' }
  }
  return { ok: true }
}
