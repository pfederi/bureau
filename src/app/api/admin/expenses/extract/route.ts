import { type NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { createServerSupabase } from '@/lib/supabase/server'
import { RECEIPT_BUCKET } from '@/lib/db/expenses'
import { extractWithGroq, GROQ_IMAGE_TYPES } from '@/lib/expenses/groq'

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

  try {
    if (file.type === 'application/pdf' || path.endsWith('.pdf')) {
      const { extractText, getDocumentProxy } = await import('unpdf')
      const { text } = await extractText(await getDocumentProxy(bytes), { mergePages: true })
      if (!text.trim()) return NextResponse.json({ error: 'Das PDF enthält keinen lesbaren Text (vermutlich ein Scan).' }, { status: 422 })
      return NextResponse.json(await extractWithGroq({ text }))
    }
    if (GROQ_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(await extractWithGroq({ image: { mime: file.type, base64: Buffer.from(bytes).toString('base64') } }))
    }
    return NextResponse.json({ error: 'Dieses Format kann nicht ausgelesen werden (z. B. HEIC).' }, { status: 415 })
  } catch (e) {
    console.error('[beleg auslesen]', e)
    return NextResponse.json({ error: 'Beleg konnte nicht ausgelesen werden.' }, { status: 502 })
  }
}
