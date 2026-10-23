import { edition } from '@/edition'
import { describe, it, expect } from 'vitest'
import { applyCheck, isPrivateIp, needsDailyCheck, normalizeSiteUrl, registrableDomain, siteHost, siteProblems, type MonitoredSite } from '@/lib/monitoring/sites'
import { buildSiteAlertEmail } from '@/lib/email/siteAlert'
import { formatDatum } from '@/lib/utils'

const site = (p: Partial<MonitoredSite> = {}): MonitoredSite => ({
  id: 's1', customer_id: 'c1', url: 'https://www.kunde.ch', geprueft_am: null, erreichbar: null, http_status: null, antwort_ms: null,
  fehler: null, fehlversuche: 0, down_seit: null, ssl_ablauf: null, domain_ablauf: null, ...p,
})
const now = new Date('2026-10-22T08:00:00Z')
const ok = { erreichbar: true, http_status: 200, antwort_ms: 120, fehler: null }
const fail = { erreichbar: false, http_status: null, antwort_ms: null, fehler: 'Verbindung abgelehnt' }

describe('normalizeSiteUrl', () => {
  it('adds https and strips the trailing slash', () => {
    expect(normalizeSiteUrl(' kunde.ch ')).toBe('https://kunde.ch')
    expect(normalizeSiteUrl('http://kunde.ch/')).toBe('http://kunde.ch')
    expect(normalizeSiteUrl('https://kunde.ch/shop?x=1#a')).toBe('https://kunde.ch/shop?x=1')
  })
  it('rejects invalid input', () => {
    expect(normalizeSiteUrl('')).toBeNull()
    expect(normalizeSiteUrl('localhost')).toBeNull()
    expect(normalizeSiteUrl('ftp://kunde.ch')).toBeNull()
    expect(normalizeSiteUrl('https://user:pw@kunde.example.ch')).toBeNull()
  })
  it('refuses internal targets (SSRF)', () => {
    for (const u of ['http://127.0.0.1', '10.0.0.5', 'http://192.168.1.1/admin', '172.20.0.3', '169.254.169.254', 'supabase.internal', 'nas.local', 'http://[::1]', 'kunde.ch:5432',
      'localhost.', 'http://kong.', 'supabase-db.', 'foo.internal.', 'http://2130706433', 'http://0x7f.1', '198.18.0.1', 'http://[::ffff:127.0.0.1]']) {
      expect(normalizeSiteUrl(u), u).toBeNull()
    }
    expect(normalizeSiteUrl('8.8.8.8')).toBe('https://8.8.8.8')
    expect(normalizeSiteUrl('kunde.ch:8443')).toBe('https://kunde.ch:8443')
  })
  it('recognises private and reserved IPs, also IPv6 and IPv4-mapped', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.31.255.255', '192.168.0.1', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) expect(isPrivateIp(ip), ip).toBe(true)
    for (const ip of ['8.8.8.8', '172.32.0.1', '2a00:1450::1']) expect(isPrivateIp(ip), ip).toBe(false)
  })
  it('derives host and registrable domain', () => {
    expect(siteHost('https://www.kunde.ch/x')).toBe('kunde.ch')
    expect(registrableDomain('shop.kunde.ch')).toBe('kunde.ch')
  })
})

describe('applyCheck', () => {
  it('reports down only after two failures in a row, keeping the first failure time', () => {
    const first = applyCheck(site(), fail, now)
    expect(first.ereignis).toBeNull()
    expect(first.update).toMatchObject({ fehlversuche: 1, down_seit: now.toISOString() })
    const later = new Date('2026-10-22T08:15:00Z')
    const second = applyCheck(site({ fehlversuche: 1, down_seit: now.toISOString() }), fail, later)
    expect(second.ereignis).toBe('down')
    expect(second.update.down_seit).toBe(now.toISOString())
    expect(applyCheck(site({ fehlversuche: 2 }), fail, later).ereignis).toBeNull()
  })
  it('reports recovery and resets the counter; a single blip is silent', () => {
    expect(applyCheck(site({ fehlversuche: 3, down_seit: now.toISOString() }), ok, now)).toMatchObject({ ereignis: 'wieder-da', update: { fehlversuche: 0, down_seit: null } })
    expect(applyCheck(site({ fehlversuche: 1 }), ok, now).ereignis).toBeNull()
  })
  it('keeps known expiry dates when a lookup returns nothing', () => {
    expect(applyCheck(site({ ssl_ablauf: '2027-01-01' }), { ...ok, ssl_ablauf: null, domain_ablauf: null }, now).update).not.toHaveProperty('ssl_ablauf')
    expect(applyCheck(site(), { ...ok, ssl_ablauf: '2027-01-01' }, now).update.ssl_ablauf).toBe('2027-01-01')
  })
  it('checks SSL and domain once a day', () => {
    expect(needsDailyCheck({ geprueft_am: null }, now)).toBe(true)
    expect(needsDailyCheck({ geprueft_am: '2026-10-22T06:00:00Z' }, now)).toBe(false)
    expect(needsDailyCheck({ geprueft_am: '2026-10-21T23:00:00Z' }, now)).toBe(true)
  })
})

describe('siteProblems', () => {
  const k = (s: MonitoredSite) => ({ ...s, kunde: 'Muster AG' })
  it('flags down sites as urgent and expiring certificates and domains', () => {
    const p = siteProblems([
      k(site({ fehlversuche: 2, down_seit: '2026-10-22T07:30:00Z', fehler: 'HTTP 502' })),
      k(site({ id: 's2', ssl_ablauf: '2026-10-24', domain_ablauf: '2026-11-10' })),
      k(site({ id: 's3', ssl_ablauf: '2027-01-01', fehlversuche: 1 })),
    ], now, formatDatum)
    expect(p.map(x => x.key)).toEqual(['website-s1', 'ssl-s2', 'domain-s2'])
    expect(p[0]).toMatchObject({ dringend: true, titel: 'kunde.ch nicht erreichbar · Muster AG', detail: 'seit 22.10.2026 09:30 · HTTP 502' })
    expect(p[1]).toMatchObject({ dringend: true, detail: 'läuft in 2 Tagen ab (24.10.2026)' })
    expect(p[2]).toMatchObject({ dringend: false, titel: 'Domain kunde.ch · Muster AG' })
  })
})

describe('buildSiteAlertEmail', () => {
  it('names the site, customer and error and links to the customer page', () => {
    const m = buildSiteAlertEmail([{ site: site(), ereignis: 'down', fehler: 'HTTP 502' }], new Map([['c1', 'Muster AG']]), 'https://admin.example.ch')
    expect(m.subject).toBe(`${edition.name}: kunde.ch nicht erreichbar`)
    expect(m.text).toContain('kunde.ch (Muster AG) ist nicht erreichbar: HTTP 502')
    expect(m.html).toContain('https://admin.example.ch/admin/kunden/c1/konto#websites')
    expect(buildSiteAlertEmail([{ site: site(), ereignis: 'wieder-da', fehler: null }], new Map(), 'x').subject).toBe(`${edition.name}: kunde.ch wieder erreichbar`)
  })
})
