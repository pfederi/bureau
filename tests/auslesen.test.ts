import { describe, it, expect, afterEach } from 'vitest'
import { belegAuslesen } from '@/lib/expenses/auslesen'

const vorher = process.env.GROQ_API_KEY
afterEach(() => { if (vorher === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = vorher })

describe('belegAuslesen', () => {
  it('ohne Schlüssel: leerer Vorschlag mit Hinweis statt Fehler', async () => {
    delete process.env.GROQ_API_KEY
    expect(await belegAuslesen(new Uint8Array([1, 2, 3]), 'application/pdf')).toEqual({ vorschlag: {}, hinweis: 'Automatisches Auslesen ist nicht eingerichtet.' })
  })
  it('nicht lesbares Format: Hinweis', async () => {
    process.env.GROQ_API_KEY = 'test'
    expect((await belegAuslesen(new Uint8Array([1]), 'image/heic')).hinweis).toBe('Dieses Format kann nicht ausgelesen werden (z. B. HEIC).')
  })
})
