import { redirect } from 'next/navigation'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase/server'

export const LOGIN_PATH = '/admin/login'
export const MFA_SETUP_PATH = '/admin/zwei-faktor'

export function isProtectedPath(pathname: string): boolean {
  if (pathname === LOGIN_PATH) return false
  if (pathname.startsWith('/api/admin/')) return true
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

/**
 * Wie weit ein Benutzer ist: nicht angemeldet, nicht auf der Admin-Liste,
 * muss noch den Code eingeben, muss 2FA erst einrichten – oder darf alles.
 */
export type AdminStep = 'anmelden' | 'kein-zugriff' | 'code' | 'einrichten' | 'ok'

export function adminStep(s: {
  user: Pick<User, 'factors'> | null
  aal: string | null
  isAdmin: boolean
}): AdminStep {
  if (!s.user) return 'anmelden'
  if (!s.isAdmin) return 'kein-zugriff'
  if (!(s.user.factors ?? []).some(f => f.status === 'verified')) return 'einrichten'
  return s.aal === 'aal2' ? 'ok' : 'code'
}

/** Wohin die Seite `pathname` bei diesem Schritt umleitet (null = bleiben). */
export function adminRedirect(pathname: string, step: AdminStep): string | null {
  const target = step === 'ok' ? null : step === 'einrichten' ? MFA_SETUP_PATH : LOGIN_PATH
  if (pathname === LOGIN_PATH || pathname === MFA_SETUP_PATH) {
    return target === pathname ? null : (target ?? '/admin')
  }
  return isProtectedPath(pathname) ? target : null
}

/** Stufe der Anmeldung aus dem Access-Token (aal1 = Passwort, aal2 = mit Code). */
export function jwtAal(token: string | undefined | null): string | null {
  const payload = token?.split('.')[1]
  if (!payload) return null
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof json.aal === 'string' ? json.aal : null
  } catch {
    return null
  }
}

export async function getAdminStep(supabase: SupabaseClient): Promise<{ step: AdminStep; user: User | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { step: 'anmelden', user: null }
  // Token wurde von getUser() eben geprüft; hier nur die Stufe auslesen
  const { data: { session } } = await supabase.auth.getSession()
  const { data: isAdmin } = await supabase.rpc('is_admin_user')
  return { step: adminStep({ user, aal: jwtAal(session?.access_token), isAdmin: isAdmin === true }), user }
}

export async function requireSession(): Promise<{ userId: string }> {
  const supabase = await createServerSupabase()
  const { step, user } = await getAdminStep(supabase)
  if (step !== 'ok' || !user) redirect(step === 'einrichten' ? MFA_SETUP_PATH : LOGIN_PATH)
  return { userId: user.id }
}
