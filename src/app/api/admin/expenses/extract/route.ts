import { type NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { createServerSupabase } from '@/lib/supabase/server'
import { RECEIPT_BUCKET } from '@/lib/db/expenses'
import { belegAuslesen } from '@/lib/expenses/auslesen'

/** Liest einen hochgeladenen Beleg aus und schlägt die Felder der Ausgabe vor. */
export async function POST(req: NextRequest) {
  await requireSession()
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'Automatisches Auslesen ist nicht eingerichtet.' }, { status: 503 })
  }
  const { path } = await req.json().catch(() => ({ path: '' }))
  if (typeof path !== 'string' || !path) return NextResponse.json({ error: 'Kein Beleg angegeben.' }, { status: 400 })

  const supabase = await createServerSupabase()
  const { data: file, error } = await supabase.storage.from(RECEIPT_BUCKET).download(path)
  if (error || !file) return NextResponse.json({ error: 'Beleg nicht gefunden.' }, { status: 404 })
  const bytes = new Uint8Array(await file.arrayBuffer())

  const mime = file.type === 'application/pdf' || path.endsWith('.pdf') ? 'application/pdf' : file.type
  const { vorschlag, hinweis } = await belegAuslesen(bytes, mime)
  if (hinweis) return NextResponse.json({ error: hinweis }, { status: 422 })
  return NextResponse.json(vorschlag)
}
