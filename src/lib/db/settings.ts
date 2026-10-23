import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'
import type { Settings } from '@/lib/types'

export const settingsSchema = z.object({
  absender_name: z.string().min(1),
  absender_adresse: z.string().min(1),
  absender_plz_ort: z.string().min(1),
  absender_land: z.string().min(1),
  absender_tel: z.string().min(1),
  absender_email: z.string().email(),
  bank_name: z.string().min(1),
  iban: z.string().min(1),
  standard_stundensatz: z.coerce.number().nonnegative(),
  mwst_hinweis: z.string(),
  naechste_nummer: z.coerce.number().int().positive(),
  grenzsteuersatz: z.coerce.number().min(0).max(60),
})

export function parseSettingsForm(fd: FormData): Partial<Settings> {
  const raw = Object.fromEntries(fd.entries())
  return settingsSchema.partial().parse(raw) as Partial<Settings>
}

export async function getSettings(): Promise<Settings> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single()
  if (error) throw error
  return data as Settings
}

export async function updateSettings(input: Partial<Settings>): Promise<void> {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('settings').update(input).eq('id', 1)
  if (error) throw error
}
