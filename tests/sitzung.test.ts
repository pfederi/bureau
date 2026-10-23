import { describe, expect, it } from 'vitest'
import {
  ABWESEND_MS, alsSitzungsCookie, FRISCH_MS, INAKTIV_MS, istEingabe, sitzungLesen, sitzungPruefen, sitzungText, tokenSitzung,
} from '@/lib/sitzung'

const jwt = (payload: object) => `x.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.y`
const kopf = (h: Record<string, string>) => ({ get: (n: string) => h[n] ?? null })

describe('Sitzungs-Cookie', () => {
  it('liest, was es schreibt, und lehnt Murks ab', () => {
    const s = { sid: 'abc-123', aktiv: 1000, gesehen: 2000 }
    expect(sitzungLesen(sitzungText(s))).toEqual(s)
    expect(sitzungLesen('abc.1.2.3')).toBeNull()
    expect(sitzungLesen('abc.x.2')).toBeNull()
    expect(sitzungLesen('')).toBeNull()
  })
})

describe('tokenSitzung', () => {
  it('nimmt Session-ID und die jüngste Anmeldung (Code nach Passwort)', () => {
    const t = jwt({ session_id: 's1', amr: [{ method: 'totp', timestamp: 200 }, { method: 'password', timestamp: 100 }] })
    expect(tokenSitzung(t)).toEqual({ sid: 's1', angemeldet: 200_000 })
  })
  it('ohne Session-ID oder kaputtes Token: null', () => {
    expect(tokenSitzung(jwt({ amr: [] }))).toBeNull()
    expect(tokenSitzung('kaputt')).toBeNull()
    expect(tokenSitzung(null)).toBeNull()
  })
})

describe('sitzungPruefen', () => {
  const jetzt = 10_000_000_000
  const cookie = (aktiv: number, gesehen = jetzt) => ({ sid: 's1', aktiv: jetzt - aktiv, gesehen })

  it('läuft weiter bei Eingabe und offener Seite', () => {
    expect(sitzungPruefen({ cookie: cookie(INAKTIV_MS - 1000), sid: 's1', angemeldet: 0, jetzt })).toBe('ok')
  })
  it('läuft nach 15 Minuten ohne Eingabe ab', () => {
    expect(sitzungPruefen({ cookie: cookie(INAKTIV_MS + 1000), sid: 's1', angemeldet: 0, jetzt })).toBe('abgelaufen')
  })
  it('läuft ab, wenn die Seite 5 Minuten kein Lebenszeichen gab (geschlossen)', () => {
    expect(sitzungPruefen({ cookie: cookie(0, jetzt - ABWESEND_MS - 1000), sid: 's1', angemeldet: 0, jetzt })).toBe('abgelaufen')
  })
  it('ohne Cookie (Browser beendet) nur direkt nach der Anmeldung neu', () => {
    expect(sitzungPruefen({ cookie: null, sid: 's1', angemeldet: jetzt - 10_000, jetzt })).toBe('neu')
    expect(sitzungPruefen({ cookie: null, sid: 's1', angemeldet: jetzt - FRISCH_MS - 1000, jetzt })).toBe('abgelaufen')
  })
  it('Cookie einer anderen Sitzung zählt nicht', () => {
    expect(sitzungPruefen({ cookie: { ...cookie(0), sid: 'alt' }, sid: 's1', angemeldet: 0, jetzt })).toBe('abgelaufen')
    expect(sitzungPruefen({ cookie: { ...cookie(0), sid: 'alt' }, sid: 's1', angemeldet: jetzt, jetzt })).toBe('neu')
  })
})

describe('istEingabe', () => {
  it('Seitenaufruf, Formular-Aktion und gemeldete Eingabe ja, Prefetch und Lebenszeichen nein', () => {
    expect(istEingabe(kopf({ 'sec-fetch-dest': 'document' }), false)).toBe(true)
    expect(istEingabe(kopf({ 'next-action': 'abc' }), false)).toBe(true)
    expect(istEingabe(kopf({}), true)).toBe(true)
    expect(istEingabe(kopf({ rsc: '1', 'next-router-prefetch': '1' }), false)).toBe(false)
    expect(istEingabe(kopf({ 'sec-fetch-dest': 'empty' }), false)).toBe(false)
  })
})

describe('alsSitzungsCookie', () => {
  it('entfernt das Ablaufdatum, Löschen bleibt', () => {
    expect(alsSitzungsCookie({ path: '/', maxAge: 34560000 })).toEqual({ path: '/' })
    expect(alsSitzungsCookie({ path: '/', expires: new Date() })).toEqual({ path: '/' })
    expect(alsSitzungsCookie({ path: '/', maxAge: 0 })).toEqual({ path: '/', maxAge: 0 })
  })
})

describe('Proxy-Matcher', () => {
  it('deckt alle Routen mit requireSession() ab (sonst greift die automatische Abmeldung dort nicht)', async () => {
    const { readFileSync, readdirSync } = await import('node:fs')
    const { join } = await import('node:path')
    const proxy = readFileSync('src/proxy.ts', 'utf8')
    const muster = [...proxy.match(/matcher:\s*\[([^\]]*)\]/)![1].matchAll(/'([^']+)'/g)].map(m => m[1].replace('/:path*', ''))
    const routen: string[] = []
    const gehe = (dir: string) => readdirSync(dir, { withFileTypes: true }).forEach(e => {
      const p = join(dir, e.name)
      if (e.isDirectory()) gehe(p)
      else if (e.name === 'route.ts' && readFileSync(p, 'utf8').includes('requireSession(')) routen.push(p.replace(/^src\/app/, '').replace(/\/route\.ts$/, ''))
    })
    gehe('src/app')
    expect(routen.length).toBeGreaterThan(5)
    expect(routen.filter(r => !muster.some(m => r === m || r.startsWith(m + '/')))).toEqual([])
  })
})
