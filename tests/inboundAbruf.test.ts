import { describe, it, expect } from 'vitest'
import { abrufMitWiederholung, anhaengeFehlerHinweis } from '@/lib/inbound/download'

const antwort = (status: number) => new Response(status === 200 ? '{"data":[]}' : '{}', { status })

describe('abrufMitWiederholung', () => {
  it('wiederholt bei 404 und 5xx mit Wartezeiten, bis es klappt', async () => {
    const folge = [404, 502, 200]
    const gewartet: number[] = []
    const res = await abrufMitWiederholung(async () => antwort(folge.shift()!), [10, 20, 30], async ms => { gewartet.push(ms) })
    expect(res.status).toBe(200)
    expect(gewartet).toEqual([10, 20])
  })
  it('gibt nach allen Versuchen die letzte Antwort zurück', async () => {
    const res = await abrufMitWiederholung(async () => antwort(404), [1, 1], async () => {})
    expect(res.status).toBe(404)
  })
  it('wiederholt nicht bei 401/403 (falscher Schlüssel bleibt falsch)', async () => {
    let n = 0
    const res = await abrufMitWiederholung(async () => { n++; return antwort(403) }, [1, 1], async () => {})
    expect(res.status).toBe(403)
    expect(n).toBe(1)
  })
})

describe('anhaengeFehlerHinweis', () => {
  it('nennt den Grund', () => {
    expect(anhaengeFehlerHinweis(401)).toContain('Schlüssel')
    expect(anhaengeFehlerHinweis(403)).toContain('Schlüssel')
    expect(anhaengeFehlerHinweis(404)).toContain('nicht gefunden')
    expect(anhaengeFehlerHinweis(503)).toContain('später')
  })
})
