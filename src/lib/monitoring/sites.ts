/**
 * Überwachung der Kundenseiten: Erreichbarkeit, SSL-Zertifikat und Domain-Ablauf.
 * Reine Logik (Zustandswechsel, Todos); das Prüfen selbst steht in check.ts.
 */

export type MonitoredSite = {
  id: string
  customer_id: string
  url: string
  created_at?: string
  geprueft_am: string | null
  erreichbar: boolean | null
  http_status: number | null
  antwort_ms: number | null
  fehler: string | null
  fehlversuche: number
  down_seit: string | null
  ssl_ablauf: string | null
  domain_ablauf: string | null
}

export type CheckResult = {
  erreichbar: boolean
  http_status: number | null
  antwort_ms: number | null
  fehler: string | null
  /** nur gesetzt, wenn geprüft (einmal pro Tag oder auf Knopfdruck) */
  ssl_ablauf?: string | null
  domain_ablauf?: string | null
}

/** Ab so vielen Fehlschlägen in Folge gilt eine Seite als down (kein Alarm bei einem Aussetzer). */
export const DOWN_AB_FEHLVERSUCHEN = 2
export const SSL_WARNUNG_TAGE = 14
export const DOMAIN_WARNUNG_TAGE = 30

/** Erlaubte Ports für überwachte Seiten (auch nach Weiterleitungen). */
export const ERLAUBTE_PORTS = ['', '80', '443', '8080', '8443']

/** Private, lokale oder reservierte IP-Adresse (IPv4 oder IPv6, auch IPv4 in IPv6 verpackt). */
export function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, '')
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIp(mapped[1])
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (m) {
    const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])]
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19))
      || (a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)
  }
  if (v.includes(':')) {
    return v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith('ff') || v.startsWith('64:ff9b:')
  }
  return false
}

/**
 * Interne Ziele (eigener Server, Docker-Netz, Router) nie prüfen: Die Prüfung läuft auf dem
 * Server und könnte sonst interne Dienste abtasten (SSRF). Hier nur am Namen bzw. an der
 * IP-Schreibweise; die aufgelöste Adresse prüft check.ts zusätzlich vor jeder Anfrage.
 */
export function isInternalHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '')
  if (!h.includes('.') && !h.includes(':')) return true
  if (/(^|\.)(localhost|local|internal|lan|home|docker|localdomain|intranet|corp)$/.test(h)) return true
  if (h.includes(':')) return true // IPv6-Literale: nicht nötig für Kundenseiten
  return isPrivateIp(h)
}

/** «kunde.ch» → «https://kunde.ch»; null bei ungültiger Eingabe oder internem Ziel. */
export function normalizeSiteUrl(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (!u.hostname.includes('.') || u.username || u.password || isInternalHost(u.hostname)) return null
    if (!ERLAUBTE_PORTS.includes(u.port)) return null
    u.hash = ''
    return u.pathname === '/' && !u.search ? u.origin : u.toString()
  } catch {
    return null
  }
}

export function siteHost(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

/** Registrierte Domain (für RDAP): die letzten zwei Teile, z. B. «shop.kunde.ch» → «kunde.ch». */
export function registrableDomain(host: string): string {
  return host.split('.').slice(-2).join('.')
}

export type SiteEvent = 'down' | 'wieder-da'

/** Neuer Zustand nach einer Prüfung und ob sich etwas Meldenswertes geändert hat. */
export function applyCheck(prev: MonitoredSite, r: CheckResult, now: Date): { update: Partial<MonitoredSite>; ereignis: SiteEvent | null } {
  const fehlversuche = r.erreichbar ? 0 : prev.fehlversuche + 1
  const warDown = prev.fehlversuche >= DOWN_AB_FEHLVERSUCHEN
  const istDown = fehlversuche >= DOWN_AB_FEHLVERSUCHEN
  const update: Partial<MonitoredSite> = {
    geprueft_am: now.toISOString(),
    erreichbar: r.erreichbar,
    http_status: r.http_status,
    antwort_ms: r.antwort_ms,
    fehler: r.fehler,
    fehlversuche,
    // «down seit» = erster Fehlschlag der Serie
    down_seit: r.erreichbar ? null : prev.down_seit ?? now.toISOString(),
  }
  // Nur mit Ergebnis überschreiben: ein Aussetzer bei der Abfrage löscht kein bekanntes Datum
  if (r.ssl_ablauf) update.ssl_ablauf = r.ssl_ablauf
  if (r.domain_ablauf) update.domain_ablauf = r.domain_ablauf
  return { update, ereignis: istDown && !warDown ? 'down' : warDown && !istDown ? 'wieder-da' : null }
}

/** SSL und Domain nur einmal pro Tag prüfen (RDAP hat Limits), Erreichbarkeit jedes Mal. */
export function needsDailyCheck(prev: Pick<MonitoredSite, 'geprueft_am'>, now: Date): boolean {
  return !prev.geprueft_am || prev.geprueft_am.slice(0, 10) !== now.toISOString().slice(0, 10)
}

const DAY = 86_400_000
export const tageBis = (iso: string, now: Date) => Math.ceil((Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) - now.getTime()) / DAY)

export type SiteTodo = {
  key: string
  titel: string
  detail: string
  customerId: string
  dringend: boolean
  tage: number
}

/** Probleme als Todos: Seite down, Zertifikat oder Domain läuft bald ab. */
export function siteProblems(sites: (MonitoredSite & { kunde: string })[], now: Date, fmtDatum: (iso: string) => string): SiteTodo[] {
  const out: SiteTodo[] = []
  for (const s of sites) {
    const host = siteHost(s.url)
    if (s.fehlversuche >= DOWN_AB_FEHLVERSUCHEN) {
      const seit = s.down_seit ? Math.max(0, Math.floor((now.getTime() - Date.parse(s.down_seit)) / 60_000)) : 0
      out.push({
        key: `website-${s.id}`, customerId: s.customer_id, dringend: true, tage: 1000 + seit,
        titel: `${host} nicht erreichbar · ${s.kunde}`,
        detail: [s.down_seit ? `seit ${fmtDatum(s.down_seit)} ${new Date(s.down_seit).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' })}` : null, s.fehler].filter(Boolean).join(' · '),
      })
    }
    if (s.ssl_ablauf) {
      const t = tageBis(s.ssl_ablauf, now)
      if (t <= SSL_WARNUNG_TAGE) out.push({
        key: `ssl-${s.id}`, customerId: s.customer_id, dringend: t <= 3, tage: -t,
        titel: `SSL-Zertifikat ${host} · ${s.kunde}`,
        detail: t < 0 ? `abgelaufen am ${fmtDatum(s.ssl_ablauf)}` : t === 0 ? 'läuft heute ab' : `läuft in ${t} ${t === 1 ? 'Tag' : 'Tagen'} ab (${fmtDatum(s.ssl_ablauf)})`,
      })
    }
    if (s.domain_ablauf) {
      const t = tageBis(s.domain_ablauf, now)
      if (t <= DOMAIN_WARNUNG_TAGE) out.push({
        key: `domain-${s.id}`, customerId: s.customer_id, dringend: t <= 7, tage: -t,
        titel: `Domain ${registrableDomain(host)} · ${s.kunde}`,
        detail: t < 0 ? `abgelaufen am ${fmtDatum(s.domain_ablauf)}` : `läuft in ${t} ${t === 1 ? 'Tag' : 'Tagen'} ab (${fmtDatum(s.domain_ablauf)})`,
      })
    }
  }
  return out
}
