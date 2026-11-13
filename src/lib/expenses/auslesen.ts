import type { ExtractedExpense } from './extract'
import { extractWithGroq, GROQ_IMAGE_TYPES } from './groq'

/** Liest einen Beleg aus (PDF-Text oder Bild über Groq). Fehler werden zum Hinweis, nie zur Ausnahme. */
export async function belegAuslesen(bytes: Uint8Array, mime: string): Promise<{ vorschlag: ExtractedExpense; hinweis: string | null }> {
  if (!process.env.GROQ_API_KEY) return { vorschlag: {}, hinweis: 'Automatisches Auslesen ist nicht eingerichtet.' }
  try {
    if (mime === 'application/pdf') {
      const { extractText, getDocumentProxy } = await import('unpdf')
      const { text } = await extractText(await getDocumentProxy(bytes), { mergePages: true })
      if (!text.trim()) return { vorschlag: {}, hinweis: 'Das PDF enthält keinen lesbaren Text (vermutlich ein Scan).' }
      return { vorschlag: await extractWithGroq({ text }), hinweis: null }
    }
    if (GROQ_IMAGE_TYPES.includes(mime)) {
      return { vorschlag: await extractWithGroq({ image: { mime, base64: Buffer.from(bytes).toString('base64') } }), hinweis: null }
    }
    return { vorschlag: {}, hinweis: 'Dieses Format kann nicht ausgelesen werden (z. B. HEIC).' }
  } catch (e) {
    console.error('[beleg auslesen]', e)
    return { vorschlag: {}, hinweis: 'Beleg konnte nicht ausgelesen werden.' }
  }
}
