import { type NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireSession } from '@/lib/auth'
import { createServerSupabase } from '@/lib/supabase/server'
import { MAX_RECEIPT_BYTES, RECEIPT_BUCKET, RECEIPT_TYPES } from '@/lib/db/expenses'

/** Beleg in den privaten Bucket laden; gibt den Objektpfad zurück (keine öffentliche URL).
 *  `?ordner=material`: Beleg zu einem Material-Eintrag (eigener Ordner im selben Bucket). */
export async function POST(req: NextRequest) {
  await requireSession()
  const file = (await req.formData()).get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Keine Datei erhalten.' }, { status: 400 })
  const ext = RECEIPT_TYPES[file.type]
  if (!ext) return NextResponse.json({ error: 'Nur PDF, JPG, PNG, WEBP oder HEIC.' }, { status: 400 })
  if (file.size <= 0 || file.size > MAX_RECEIPT_BYTES) return NextResponse.json({ error: 'Die Datei ist leer oder grösser als 10 MB.' }, { status: 400 })

  const now = new Date()
  const prefix = req.nextUrl.searchParams.get('ordner') === 'material' ? 'material/' : ''
  const path = `${prefix}${now.getUTCFullYear()}/${now.toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}.${ext}`
  const supabase = await createServerSupabase()
  const { error } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (error) {
    console.error('[beleg upload]', error)
    return NextResponse.json({ error: 'Upload fehlgeschlagen.' }, { status: 500 })
  }
  return NextResponse.json({ path, name: file.name })
}
