import { type NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { createServerSupabase } from '@/lib/supabase/server'
import { RECEIPT_BUCKET } from '@/lib/db/expenses'
import { getBelegEingang } from '@/lib/db/belegEingang'

/** Leitet auf einen kurzlebigen signierten Link zum Beleg im Eingang weiter. */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  await requireSession()
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return NextResponse.json({ error: 'Kein Beleg vorhanden.' }, { status: 404 })
  const eintrag = await getBelegEingang(params.id)
  if (!eintrag?.beleg_path) return NextResponse.json({ error: 'Kein Beleg vorhanden.' }, { status: 404 })
  const { data, error } = await (await createServerSupabase()).storage.from(RECEIPT_BUCKET).createSignedUrl(eintrag.beleg_path, 60)
  if (error || !data) return NextResponse.json({ error: 'Beleg nicht gefunden.' }, { status: 404 })
  return NextResponse.redirect(data.signedUrl)
}
