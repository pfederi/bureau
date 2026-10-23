import { EXTRACT_PROMPT, parseExtraction, type ExtractedExpense } from './extract'

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
/** Multimodales Modell (Text und Bild); per GROQ_MODEL austauschbar. */
const DEFAULT_MODEL = 'qwen/qwen3.8-27b'
/** Bildformate, die Groq annimmt (HEIC nicht). */
export const GROQ_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

type Input = { text: string } | { image: { mime: string; base64: string } }

/** Beleg an Groq schicken und einen geprüften Vorschlag zurückgeben. */
export async function extractWithGroq(input: Input): Promise<ExtractedExpense> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY fehlt')
  const content = 'text' in input
    ? `${EXTRACT_PROMPT}\n\nText des Belegs:\n"""\n${input.text.slice(0, 12000)}\n"""`
    : [
        { type: 'text', text: EXTRACT_PROMPT },
        { type: 'image_url', image_url: { url: `data:${input.image.mime};base64,${input.image.base64}` } },
      ]
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || DEFAULT_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content }],
    }),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  return parseExtraction(String(json?.choices?.[0]?.message?.content ?? ''))
}
