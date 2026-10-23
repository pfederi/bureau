// src/lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js'

export function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      // Next.js würde die Abfragen sonst im Data Cache halten: ein widerrufener Kundenlink
      // bliebe gültig, Wochenmail und Überwachung sähen alte Daten.
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    },
  )
}
