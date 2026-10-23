import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Prüft einen Code gegen alle eingerichteten Geräte (Faktoren) und hebt die
 * Session bei Erfolg auf aal2. Mit zwei Geräten weiss man nicht, zu welchem der Code gehört.
 */
export async function verifyTotp(supabase: SupabaseClient, code: string): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error || !data) return false
  for (const factor of data.totp) {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
    if (!error) return true
  }
  return false
}

/** Hat der Benutzer verifizierte Passkeys bzw. Authenticator-Apps? */
export async function factorKinds(supabase: SupabaseClient): Promise<{ passkey: boolean; totp: boolean }> {
  const { data } = await supabase.auth.mfa.listFactors()
  return { passkey: (data?.webauthn?.length ?? 0) > 0, totp: (data?.totp?.length ?? 0) > 0 }
}

/**
 * Bestätigung mit Passkey (Touch ID, Face ID, Sicherheitsschlüssel). Mehrere Passkeys
 * (z. B. Mac und iPhone) werden der Reihe nach versucht.
 */
export async function verifyPasskey(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.auth.mfa.listFactors()
  for (const factor of data?.webauthn ?? []) {
    const { error } = await supabase.auth.mfa.webauthn.authenticate({ factorId: factor.id })
    if (!error) return true
  }
  return false
}

/** Fehlermeldung beim Einrichten eines Passkeys in verständlichem Deutsch. */
export function passkeyErrorText(error: { code?: string; message?: string; name?: string } | null): string {
  const code = (error as any)?.code ?? ''
  const msg = `${error?.name ?? ''} ${error?.message ?? ''}`
  if (code === 'mfa_webauthn_enroll_not_enabled' || code === 'mfa_webauthn_verify_not_enabled') return 'Passkeys sind auf dem Server noch nicht freigeschaltet.'
  if (/NotAllowed|cancel|abort/i.test(msg)) return 'Abgebrochen oder abgelaufen. Bitte nochmals versuchen.'
  if (/support/i.test(msg)) return 'Dieser Browser unterstützt keine Passkeys.'
  if (/exists/i.test(msg)) return 'Dieser Name ist schon vergeben. Bitte wähle einen anderen.'
  return 'Der Passkey konnte nicht eingerichtet werden.'
}
