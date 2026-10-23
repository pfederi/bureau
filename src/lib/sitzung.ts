/**
 * Automatische Abmeldung im Admin: nach 15 Minuten ohne Eingabe und wenn der Browser bzw.
 * der Tab geschlossen wurde. Reine Logik; Signatur und Cookies in `src/proxy.ts`.
 *
 * Der Proxy führt ein Sitzungs-Cookie (ohne Ablaufdatum, verschwindet beim Beenden des
 * Browsers) mit Session-ID, letzter Eingabe und letztem Lebenszeichen der offenen Seite.
 * Die Seite meldet sich jede Minute (`/api/admin/sitzung`); bleibt das 5 Minuten aus,
 * war sie geschlossen.
 */

export const SITZUNG_COOKIE = 'ls_sitzung'
export const INAKTIV_MS = 15 * 60_000
export const ABWESEND_MS = 5 * 60_000
/** So frisch muss die Anmeldung sein, damit ein fehlendes Sitzungs-Cookie neu angelegt wird. */
export const FRISCH_MS = 2 * 60_000
export const LEBENSZEICHEN_MS = 60_000
export const WARNUNG_MS = 60_000

export type Sitzung = { sid: string; aktiv: number; gesehen: number }

/** Inhalt ohne Signatur: `sid.aktiv.gesehen` */
export function sitzungText(s: Sitzung): string {
  return `${s.sid}.${s.aktiv}.${s.gesehen}`
}

export function sitzungLesen(text: string): Sitzung | null {
  const [sid, aktiv, gesehen, ...rest] = text.split('.')
  if (rest.length || !sid || !/^\d+$/.test(aktiv ?? '') || !/^\d+$/.test(gesehen ?? '')) return null
  return { sid, aktiv: Number(aktiv), gesehen: Number(gesehen) }
}

/** Session-ID und Zeitpunkt der letzten Anmeldung (Passwort, Code oder Passkey) aus dem Access-Token. */
export function tokenSitzung(token: string | undefined | null): { sid: string; angemeldet: number } | null {
  const payload = token?.split('.')[1]
  if (!payload) return null
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    if (typeof json.session_id !== 'string') return null
    const zeiten = (Array.isArray(json.amr) ? json.amr : [])
      .map((a: { timestamp?: unknown }) => a?.timestamp)
      .filter((t: unknown): t is number => typeof t === 'number')
    return { sid: json.session_id, angemeldet: zeiten.length ? Math.max(...zeiten) * 1000 : 0 }
  } catch {
    return null
  }
}

/**
 * Darf die Sitzung weiterlaufen? Ohne gültiges Cookie zur selben Session nur direkt nach
 * der Anmeldung – sonst wurde der Browser beendet (Cookie weg) oder jemand bastelt.
 */
export function sitzungPruefen(s: {
  cookie: Sitzung | null
  sid: string
  angemeldet: number
  jetzt: number
}): 'ok' | 'neu' | 'abgelaufen' {
  const c = s.cookie
  if (c && c.sid === s.sid) {
    if (s.jetzt - c.aktiv > INAKTIV_MS || s.jetzt - c.gesehen > ABWESEND_MS) return 'abgelaufen'
    return 'ok'
  }
  return s.jetzt - s.angemeldet < FRISCH_MS ? 'neu' : 'abgelaufen'
}

/** Gilt eine Anfrage als Eingabe? Seitenaufrufe, Formular-Aktionen und gemeldete Eingaben ja, Prefetch nicht. */
export function istEingabe(h: { get(name: string): string | null }, aktivMeldung: boolean): boolean {
  if (aktivMeldung) return true
  if (h.get('next-router-prefetch')) return false
  return h.get('sec-fetch-dest') === 'document' || !!h.get('next-action')
}

/** Supabase-Cookies ohne Ablaufdatum setzen, damit sie beim Beenden des Browsers verschwinden (Löschen bleibt). */
export function alsSitzungsCookie<T extends { maxAge?: number; expires?: Date }>(options: T): T {
  if (options.maxAge === 0) return options
  const { maxAge: _m, expires: _e, ...rest } = options
  return rest as T
}
