import { createClient } from '@supabase/supabase-js'

/**
 * Client für öffentliche Leseabfragen (anon, RLS greift). Bewusst OHNE Cookies:
 * `next/headers` würde die Startseite zu einer dynamischen Route machen und ISR
 * aushebeln. Für alles im Admin gehört weiterhin `createServerSupabase()` her.
 */
export function createPublicSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
