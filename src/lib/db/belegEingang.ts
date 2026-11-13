import { createAdminSupabase } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { RECEIPT_BUCKET } from '@/lib/db/expenses'
import type { ExtractedExpense } from '@/lib/expenses/extract'
import type { Settings } from '@/lib/types'

export type BelegEingang = {
  id: string; created_at: string; absender: string; betreff: string | null
  beleg_path: string | null; beleg_name: string | null; vorschlag: ExtractedExpense; hinweis: string | null
}
const SPALTEN = 'id, created_at, absender, betreff, beleg_path, beleg_name, vorschlag, hinweis'

// ── Admin (angemeldet, RLS) ──
export async function listBelegEingang(): Promise<BelegEingang[]> {
  const { data, error } = await (await createServerSupabase()).from('beleg_eingang').select(SPALTEN).order('created_at', { ascending: false })
  if (error) throw error
  return data as BelegEingang[]
}

export async function getBelegEingang(id: string): Promise<BelegEingang | null> {
  const { data, error } = await (await createServerSupabase()).from('beleg_eingang').select(SPALTEN).eq('id', id).maybeSingle()
  if (error) throw error
  return data as BelegEingang | null
}

/** Eintrag löschen; mitDatei: auch den Beleg im Speicher (Verwerfen), sonst bleibt er (an der Ausgabe). */
export async function deleteBelegEingang(id: string, mitDatei: boolean): Promise<void> {
  const supabase = await createServerSupabase()
  const eintrag = await getBelegEingang(id)
  if (!eintrag) return
  const { error } = await supabase.from('beleg_eingang').delete().eq('id', id)
  if (error) throw error
  if (mitDatei && eintrag.beleg_path) await supabase.storage.from(RECEIPT_BUCKET).remove([eintrag.beleg_path])
}

// ── Webhook (ohne Anmeldung, Service-Key) ──
export async function belegEinstellungen(): Promise<Pick<Settings, 'absender_email' | 'beleg_absender'>> {
  const { data, error } = await createAdminSupabase().from('settings').select('absender_email, beleg_absender').eq('id', 1).single()
  if (error) throw error
  return data as Pick<Settings, 'absender_email' | 'beleg_absender'>
}

export async function eingangVorhanden(mailId: string, anhangId: string): Promise<boolean> {
  const { data, error } = await createAdminSupabase().from('beleg_eingang').select('id').eq('mail_id', mailId).eq('anhang_id', anhangId).maybeSingle()
  if (error) throw error
  return data !== null
}

export async function ladeEingangDatei(path: string, bytes: Uint8Array, mime: string): Promise<void> {
  const { error } = await createAdminSupabase().storage.from(RECEIPT_BUCKET).upload(path, bytes, { contentType: mime, upsert: false })
  if (error) throw error
}

export async function loescheEingangDatei(path: string): Promise<void> {
  await createAdminSupabase().storage.from(RECEIPT_BUCKET).remove([path])
}

/** false, wenn der Anhang schon im Eingang ist (Resend hat die Mail nochmals geschickt). */
export async function speichereEingang(row: Omit<BelegEingang, 'id' | 'created_at'> & { mail_id: string; anhang_id: string }): Promise<boolean> {
  const { error } = await createAdminSupabase().from('beleg_eingang').insert(row)
  if (error?.code === '23505') return false
  if (error) throw error
  return true
}
