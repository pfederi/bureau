// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { alsSitzungsCookie } from '@/lib/sitzung'

export async function createServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, alsSitzungsCookie(options)),
            )
          } catch {
            // aufgerufen aus Server-Komponente ohne Schreibrecht — ignorierbar,
            // Middleware refresht die Session
          }
        },
      },
    },
  )
}
