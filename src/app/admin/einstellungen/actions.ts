'use server'
import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { requireSession } from '@/lib/auth'
import { parseSettingsForm, updateSettings } from '@/lib/db/settings'

type Result = { ok: boolean; error?: string }

const FELD: Record<string, string> = {
  absender_name: 'Absender Name', absender_adresse: 'Adresse', absender_plz_ort: 'PLZ / Ort', absender_land: 'Land',
  absender_tel: 'Telefon', absender_email: 'E-Mail', bank_name: 'Bank', iban: 'IBAN',
  standard_stundensatz: 'Standard-Stundensatz', mwst_hinweis: 'MWST-Hinweis', grenzsteuersatz: 'Grenzsteuersatz (0 bis 60 %)',
}

export async function saveSettings(formData: FormData): Promise<Result> {
  await requireSession()
  try {
    await updateSettings(parseSettingsForm(formData))
  } catch (e) {
    if (e instanceof ZodError) {
      const felder = Array.from(new Set(e.issues.map(i => FELD[String(i.path[0])] ?? String(i.path[0]))))
      return { ok: false, error: `Bitte prüfen: ${felder.join(', ')}` }
    }
    return { ok: false, error: 'Einstellungen konnten nicht gespeichert werden.' }
  }
  revalidatePath('/admin', 'layout')
  return { ok: true }
}
