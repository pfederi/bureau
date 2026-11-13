import { describe, it, expect } from 'vitest'
import { antwortDatum, antwortSchema, heuteZuerich, offerteZustand } from '@/lib/portal/quotes'
import { portalText } from '@/lib/portal/text'

describe('offerteZustand', () => {
  it('offen bis und mit gueltig_bis, danach abgelaufen', () => {
    expect(offerteZustand({ status: 'versendet', gueltig_bis: '2026-11-13' }, '2026-11-13')).toBe('offen')
    expect(offerteZustand({ status: 'versendet', gueltig_bis: '2026-11-13' }, '2026-11-14')).toBe('abgelaufen')
    expect(offerteZustand({ status: 'versendet', gueltig_bis: null }, '2030-01-01')).toBe('offen')
  })
  it('beantwortete und Entwürfe', () => {
    expect(offerteZustand({ status: 'angenommen', gueltig_bis: '2020-01-01' }, '2026-11-13')).toBe('angenommen')
    expect(offerteZustand({ status: 'abgelehnt', gueltig_bis: null }, '2026-11-13')).toBe('abgelehnt')
    expect(offerteZustand({ status: 'entwurf', gueltig_bis: null }, '2026-11-13')).toBeNull()
  })
})

describe('heuteZuerich', () => {
  it('nimmt das Datum in Zürcher Zeit', () => {
    expect(heuteZuerich(new Date('2026-11-13T23:30:00Z'))).toBe('2026-11-14')
    expect(heuteZuerich(new Date('2026-07-01T21:59:00Z'))).toBe('2026-07-01')
  })
})

describe('antwortSchema', () => {
  const ok = { antwort: 'annehmen', name: '  Max Muster ', bestaetigt: true }
  it('akzeptiert eine gültige Annahme und trimmt', () => {
    expect(antwortSchema.parse(ok)).toMatchObject({ antwort: 'annehmen', name: 'Max Muster', grund: null })
  })
  it('verlangt die Bestätigung beim Annehmen, nicht beim Ablehnen', () => {
    expect(antwortSchema.safeParse({ ...ok, bestaetigt: false }).success).toBe(false)
    expect(antwortSchema.safeParse({ antwort: 'ablehnen', name: 'Max Muster', grund: 'zu teuer' }).success).toBe(true)
  })
  it('prüft Name und Grund', () => {
    expect(antwortSchema.safeParse({ ...ok, name: 'M' }).success).toBe(false)
    expect(antwortSchema.safeParse({ ...ok, name: 'x'.repeat(101) }).success).toBe(false)
    expect(antwortSchema.safeParse({ antwort: 'ablehnen', name: 'Max', grund: 'x'.repeat(1001) }).success).toBe(false)
    expect(antwortSchema.parse({ antwort: 'ablehnen', name: 'Max', grund: '   ' }).grund).toBeNull()
    expect(antwortSchema.safeParse({ antwort: 'loeschen', name: 'Max' }).success).toBe(false)
    expect(antwortSchema.safeParse(null).success).toBe(false)
  })
})

describe('portalText', () => {
  it('Sie und Du', () => {
    expect(portalText('sie').name).toBe('Ihr Name')
    expect(portalText('du').name).toBe('Dein Name')
    expect(portalText('sie').neueOfferte).toBe('Bitte melden Sie sich für eine neue Offerte.')
    expect(portalText('du').neueOfferte).toBe('Melde dich für eine neue Offerte.')
  })
})

describe('antwortDatum', () => {
  it('zeigt den Tag der Antwort in Zürcher Zeit', () => {
    expect(antwortDatum('2026-11-13T23:30:00Z')).toBe('14.11.2026')
    expect(antwortDatum('2026-11-13T10:00:00+00:00')).toBe('13.11.2026')
  })
})

describe('antwortSchema mit Emoji', () => {
  it('zählt Zeichen wie die Datenbank (ein Emoji ist ein Zeichen)', () => {
    expect(antwortSchema.safeParse({ antwort: 'ablehnen', name: '🙂' }).success).toBe(false)
    expect(antwortSchema.safeParse({ antwort: 'ablehnen', name: '🙂🙂' }).success).toBe(true)
    expect(antwortSchema.safeParse({ antwort: 'ablehnen', name: '🙂'.repeat(100) }).success).toBe(true)
    expect(antwortSchema.safeParse({ antwort: 'ablehnen', name: '🙂'.repeat(101) }).success).toBe(false)
  })
})
