import { describe, it, expect } from 'vitest'
import { absenderErlaubt, eingangDateiLoeschen, erlaubterAnhang, istResendDownload, sichererDateiname } from '@/lib/inbound/belege'

const s = { absender_email: 'anna@example.ch', beleg_absender: ['Handy@Example.ch'] }

describe('absenderErlaubt', () => {
  it('Absender-Adresse und Liste, ohne Gross-/Kleinschreibung, mit Anzeigename', () => {
    expect(absenderErlaubt('anna@example.ch', s)).toBe(true)
    expect(absenderErlaubt('Anna Muster <ANNA@example.ch>', s)).toBe(true)
    expect(absenderErlaubt('handy@example.ch', s)).toBe(true)
    expect(absenderErlaubt('boese@example.org', s)).toBe(false)
    expect(absenderErlaubt('', s)).toBe(false)
    expect(absenderErlaubt(null, { absender_email: 'anna@example.ch' })).toBe(false)
  })
})

describe('erlaubterAnhang', () => {
  it('Typ und Grösse', () => {
    expect(erlaubterAnhang({ content_type: 'application/pdf', size: 50_000 })).toBe(true)
    expect(erlaubterAnhang({ content_type: 'image/heic', size: 50_000 })).toBe(false)
    expect(erlaubterAnhang({ content_type: 'application/pdf', size: 11 * 1024 * 1024 })).toBe(false)
    expect(erlaubterAnhang({ content_type: 'application/pdf', size: 0 })).toBe(false)
  })
  it('kleine Inline-Bilder (Logos) überspringen, grosse Inline-Bilder behalten', () => {
    expect(erlaubterAnhang({ content_type: 'image/png', size: 8_000, content_disposition: 'inline' })).toBe(false)
    expect(erlaubterAnhang({ content_type: 'image/jpeg', size: 300_000, content_disposition: 'inline' })).toBe(true)
  })
})

describe('sichererDateiname und istResendDownload', () => {
  it('bereinigt Dateinamen', () => {
    expect(sichererDateiname('Rechnung Nov/2026 (1).pdf')).toBe('Rechnung-Nov-2026-1-.pdf')
    expect(sichererDateiname('../../etc/passwd')).toBe('etc-passwd')
    expect(sichererDateiname('')).toBe('beleg')
    expect(sichererDateiname('a'.repeat(200) + '.pdf').length).toBeLessThanOrEqual(80)
  })
  it('nur Resends Download-Server über https', () => {
    expect(istResendDownload('https://inbound-cdn.resend.com/x/attachments/y?signature=z')).toBe(true)
    expect(istResendDownload('http://inbound-cdn.resend.com/x')).toBe(false)
    expect(istResendDownload('https://inbound-cdn.resend.com.boese.example/x')).toBe(false)
    expect(istResendDownload('https://169.254.169.254/latest')).toBe(false)
    expect(istResendDownload(undefined)).toBe(false)
  })
})

describe('Absender-Prüfung gegen Tricks im Anzeigenamen', () => {
  it('nimmt die echte Adresse in der letzten spitzen Klammer, nicht eine im Namen versteckte', () => {
    expect(absenderErlaubt('"<anna@example.ch>" <boese@example.org>', s)).toBe(false)
    expect(absenderErlaubt('"Anna <privat>" <anna@example.ch>', s)).toBe(true)
  })
})

describe('eingangDateiLoeschen', () => {
  it('löscht die Eingangsdatei nur, wenn die Ausgabe einen anderen oder keinen Beleg hat', () => {
    expect(eingangDateiLoeschen('eingang/a.pdf', 'eingang/a.pdf')).toBe(false)
    expect(eingangDateiLoeschen('eingang/a.pdf', '2026/neu.pdf')).toBe(true)
    expect(eingangDateiLoeschen('eingang/a.pdf', '')).toBe(true)
    expect(eingangDateiLoeschen(null, '')).toBe(false)
  })
})

describe('istResendDownload mit aktuellem CDN', () => {
  it('akzeptiert cdn.resend.app (aktuell) und inbound-cdn.resend.com, keine Nachahmer', () => {
    expect(istResendDownload('https://cdn.resend.app/abc/attachments/x.pdf?sig=1')).toBe(true)
    expect(istResendDownload('https://inbound-cdn.resend.com/x')).toBe(true)
    expect(istResendDownload('https://cdn.resend.app.boese.example/x')).toBe(false)
    expect(istResendDownload('https://boese-cdn.resend.app/x')).toBe(false)
    expect(istResendDownload('http://cdn.resend.app/x')).toBe(false)
  })
})
