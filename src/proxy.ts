import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { adminRedirect, getAdminStep, LOGIN_PATH } from '@/lib/auth'
import {
  alsSitzungsCookie, istEingabe, SITZUNG_COOKIE, sitzungLesen, sitzungPruefen, sitzungText, tokenSitzung,
} from '@/lib/sitzung'

// Signiert, damit sich die Zeiten im Cookie nicht von Hand verlängern lassen
const SCHLUESSEL = process.env.SUPABASE_SERVICE_ROLE_KEY

function signatur(text: string): string {
  return createHmac('sha256', `ls-sitzung:${SCHLUESSEL}`).update(text).digest('base64url')
}

function cookieLesen(wert: string | undefined) {
  if (!wert) return null
  const i = wert.lastIndexOf('~')
  if (i < 0) return null
  const text = wert.slice(0, i)
  const a = Buffer.from(wert.slice(i + 1))
  const b = Buffer.from(signatur(text))
  return a.length === b.length && timingSafeEqual(a, b) ? sitzungLesen(text) : null
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, alsSitzungsCookie(options)),
          )
        },
      },
    },
  )

  let { step } = await getAdminStep(supabase)
  let sitzung: string | null = null
  let abgelaufen = false

  // Automatische Abmeldung (src/lib/sitzung.ts), erst nach vollständiger Anmeldung
  if (step === 'ok') {
    const { data: { session } } = await supabase.auth.getSession()
    const token = tokenSitzung(session?.access_token)
    const jetzt = Date.now()
    const cookie = cookieLesen(request.cookies.get(SITZUNG_COOKIE)?.value)
    // ohne Schlüssel liesse sich das Cookie fälschen – dann lieber gar nicht
    const ergebnis = token && SCHLUESSEL ? sitzungPruefen({ cookie, sid: token.sid, angemeldet: token.angemeldet, jetzt }) : 'abgelaufen'
    if (ergebnis === 'abgelaufen') {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => null) // nur diese Sitzung, andere Geräte bleiben angemeldet
      // Anmelde-Cookies auch dann entfernen, wenn Supabase das Abmelden ablehnt (sonst Umleitungsschleife)
      const anmeldung = request.cookies.getAll().filter(c => c.name.startsWith('sb-'))
      anmeldung.forEach(c => request.cookies.delete(c.name))
      response = NextResponse.next({ request }) // Routen sehen die Cookies so auch nicht mehr
      anmeldung.forEach(c => response.cookies.delete(c.name))
      step = 'anmelden'
      abgelaufen = true
    } else {
      const eingabe = istEingabe(request.headers, request.nextUrl.searchParams.get('aktiv') === '1')
      const text = sitzungText({
        sid: token!.sid,
        aktiv: eingabe || ergebnis === 'neu' ? jetzt : cookie!.aktiv,
        gesehen: jetzt,
      })
      sitzung = `${text}~${signatur(text)}`
    }
  }

  const setzeSitzung = (res: NextResponse) => {
    if (sitzung) {
      res.cookies.set(SITZUNG_COOKIE, sitzung, {
        httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production',
      })
    } else if (request.cookies.has(SITZUNG_COOKIE)) {
      res.cookies.delete(SITZUNG_COOKIE)
    }
    return res
  }

  const target = adminRedirect(request.nextUrl.pathname, step)

  if (target) {
    const url = request.nextUrl.clone()
    url.pathname = target
    url.search = abgelaufen && target === LOGIN_PATH ? '?grund=abgemeldet' : ''
    const redirect = NextResponse.redirect(url)
    // aufgefrischte Session-Cookies nicht verlieren
    response.cookies.getAll().forEach(c => redirect.cookies.set(c))
    return setzeSitzung(redirect)
  }
  return setzeSitzung(response)
}

export const config = {
  // alle Pfade mit requireSession() (Test: tests/sitzung.test.ts)
  matcher: ['/admin/:path*', '/api/admin/:path*', '/api/invoices/:path*', '/api/quotes/:path*', '/api/time-entries/:path*'],
}
