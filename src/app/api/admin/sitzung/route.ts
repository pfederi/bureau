import { type NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { createServerSupabase } from '@/lib/supabase/server'
import { SITZUNG_COOKIE } from '@/lib/sitzung'

/**
 * Lebenszeichen der offenen Admin-Seite (Zeiten führt der Proxy nach, `?aktiv=1` = es gab Eingaben).
 * `?ende=1`: nach 15 Minuten ohne Eingabe von der Seite selbst abmelden.
 */
export async function POST(req: NextRequest) {
  await requireSession()
  if (req.nextUrl.searchParams.get('ende') !== '1') return new NextResponse(null, { status: 204 })
  const supabase = await createServerSupabase()
  await supabase.auth.signOut({ scope: 'local' })
  const res = new NextResponse(null, { status: 204 })
  res.cookies.delete(SITZUNG_COOKIE)
  return res
}
