import { connect } from 'tls'
import { lookup } from 'dns/promises'
import { edition } from '@/edition'
import { ERLAUBTE_PORTS, isInternalHost, isPrivateIp, registrableDomain, type CheckResult } from './sites'

const TIMEOUT_MS = 15_000
const UA = `Mozilla/5.0 (compatible; ${edition.slug}-monitor/1.0${edition.domain ? `; +https://${edition.domain}` : ''})`

class InternesZiel extends Error {}

/**
 * Ziel muss öffentlich sein: Name, Port und alle aufgelösten Adressen. Fängt Namen ab, die auf
 * interne Adressen zeigen (z. B. 127.0.0.1.nip.io); Rebinding zwischen Prüfung und Abruf bleibt
 * theoretisch möglich, ist aber bei einer reinen Statusabfrage ohne Inhalt ein kleines Risiko.
 */
async function assertPublic(url: URL): Promise<void> {
  if (!/^https?:$/.test(url.protocol) || !ERLAUBTE_PORTS.includes(url.port) || isInternalHost(url.hostname)) {
    throw new InternesZiel('Ziel ist eine interne Adresse')
  }
  // Ohne Auflösung kein Abruf (fail closed): fetch würde den Namen sonst neu auflösen
  const adressen = await lookup(url.hostname.replace(/\.+$/, ''), { all: true })
    .catch(() => { throw new InternesZiel('Domain nicht gefunden (DNS)') })
  if (adressen.length === 0 || adressen.some(a => isPrivateIp(a.address))) throw new InternesZiel('Domain zeigt auf eine interne Adresse')
}

/** Ablaufdatum des SSL-Zertifikats (YYYY-MM-DD) oder null. */
export function sslExpiry(host: string): Promise<string | null> {
  return new Promise(resolve => {
    const socket = connect({ host, port: 443, servername: host, rejectUnauthorized: false, timeout: TIMEOUT_MS }, () => {
      const cert = socket.getPeerCertificate()
      socket.end()
      const d = cert?.valid_to ? new Date(cert.valid_to) : null
      resolve(d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null)
    })
    socket.on('error', () => resolve(null))
    socket.on('timeout', () => { socket.destroy(); resolve(null) })
  })
}

/**
 * Ablaufdatum der Domain über RDAP oder null. .ch/.li veröffentlichen kein Ablaufdatum
 * (SWITCH) – dort bleibt es leer; die Verlängerung meldet der Hinweis auf fehlende Belege.
 */
export async function domainExpiry(host: string): Promise<string | null> {
  const domain = registrableDomain(host)
  if (/\.(ch|li)$/i.test(domain)) return null
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { Accept: 'application/rdap+json', 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json() as { events?: { eventAction?: string; eventDate?: string }[] }
    const ev = data.events?.find(e => e.eventAction === 'expiration')?.eventDate
    return ev ? new Date(ev).toISOString().slice(0, 10) : null
  } catch {
    return null
  }
}

function fehlerText(e: unknown): string {
  const err = e as { name?: string; message?: string; cause?: { code?: string; message?: string } }
  if (e instanceof InternesZiel) return e.message
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return `keine Antwort innert ${TIMEOUT_MS / 1000} Sekunden`
  const code = err?.cause?.code ?? ''
  if (code === 'ENOTFOUND') return 'Domain nicht gefunden (DNS)'
  if (code === 'ECONNREFUSED') return 'Verbindung abgelehnt'
  if (code === 'ECONNRESET' || code.startsWith('UND_ERR')) return 'Verbindung unterbrochen'
  if (code === 'ETIMEDOUT') return 'Zeitüberschreitung'
  if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH') return 'Server nicht erreichbar'
  if (/CERT|SSL|TLS/i.test(code)) return `Zertifikat ungültig (${code})`
  return err?.cause?.message ?? err?.message ?? 'unbekannter Fehler'
}

/** Erreichbarkeit prüfen; mit `taeglich` auch SSL-Zertifikat und Domain. */
export async function checkSite(url: string, taeglich: boolean): Promise<CheckResult> {
  const host = new URL(url).hostname
  const start = Date.now()
  let result: CheckResult
  try {
    // Weiterleitungen selbst folgen, damit keine auf ein internes Ziel führt (SSRF)
    const signal = AbortSignal.timeout(TIMEOUT_MS)
    let ziel = new URL(url)
    await assertPublic(ziel)
    let res = await fetch(ziel, { redirect: 'manual', headers: { 'User-Agent': UA }, signal, cache: 'no-store' })
    for (let i = 0; i < 5 && res.status >= 300 && res.status < 400 && res.headers.get('location'); i++) {
      const next = new URL(res.headers.get('location')!, ziel)
      await assertPublic(next).catch(() => { throw new InternesZiel('Weiterleitung auf ein nicht erlaubtes Ziel (internes Netz oder Port)') })
      await res.body?.cancel().catch(() => {})
      ziel = next
      res = await fetch(ziel, { redirect: 'manual', headers: { 'User-Agent': UA }, signal, cache: 'no-store' })
    }
    // 401/403: der Server antwortet (z. B. Passwortschutz) – also erreichbar
    const ok = res.status < 400 || res.status === 401 || res.status === 403
    result = { erreichbar: ok, http_status: res.status, antwort_ms: Date.now() - start, fehler: ok ? null : `HTTP ${res.status}` }
    await res.body?.cancel().catch(() => {})
  } catch (e) {
    result = { erreichbar: false, http_status: null, antwort_ms: null, fehler: fehlerText(e) }
  }
  if (taeglich) {
    const intern = await assertPublic(new URL(url)).then(() => false, () => true)
    const [ssl, domain] = await Promise.all([url.startsWith('https:') && !intern ? sslExpiry(host) : Promise.resolve(null), domainExpiry(host)])
    result.ssl_ablauf = ssl
    result.domain_ablauf = domain
  }
  return result
}
