import { type NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { parseRate, rateUrl } from '@/lib/expenses/currency'

/** Franken-Kurs für EUR/USD an einem Datum (EZB-Referenzkurs). */
export async function GET(req: NextRequest) {
  await requireSession()
  const waehrung = req.nextUrl.searchParams.get('waehrung')
  const datum = req.nextUrl.searchParams.get('datum') ?? ''
  if ((waehrung !== 'EUR' && waehrung !== 'USD') || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }
  try {
    const res = await fetch(rateUrl(waehrung, datum), { next: { revalidate: 86400 } })
    const rate = res.ok ? parseRate(await res.json()) : null
    if (!rate) return NextResponse.json({ error: 'Kein Kurs für dieses Datum.' }, { status: 404 })
    return NextResponse.json(rate)
  } catch {
    return NextResponse.json({ error: 'Kursdienst nicht erreichbar.' }, { status: 502 })
  }
}
