import { type NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { createServerSupabase } from '@/lib/supabase/server'
import { getExpense, RECEIPT_BUCKET } from '@/lib/db/expenses'

/** Leitet auf einen kurzlebigen signierten Link zum Beleg weiter. */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  await requireSession()
  const expense = await getExpense(params.id)
  if (!expense?.beleg_path) return NextResponse.json({ error: 'Kein Beleg vorhanden.' }, { status: 404 })
  const supabase = await createServerSupabase()
  const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(expense.beleg_path, 60)
  if (error || !data) return NextResponse.json({ error: 'Beleg nicht gefunden.' }, { status: 404 })
  return NextResponse.redirect(data.signedUrl)
}
