// src/lib/supabase/client.ts
'use client'
import { createBrowserClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import { alsSitzungsCookie } from '@/lib/sitzung'

export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Wie auf dem Server: Anmelde-Cookies ohne Ablaufdatum (weg, sobald der Browser beendet wird)
      cookies: {
        getAll: () => parseCookieHeader(document.cookie),
        setAll: list => list.forEach(({ name, value, options }) => {
          document.cookie = serializeCookieHeader(name, value, alsSitzungsCookie(options))
        }),
      },
    },
  )
}
