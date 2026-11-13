export const BELEG_TYPEN = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const
export const MAX_BELEG_BYTES = 10 * 1024 * 1024
export const MAX_ANHAENGE = 10
/** Kleinere Inline-Bilder sind meist Logos oder Signaturen */
const LOGO_GRENZE = 20 * 1024

export type ResendAnhang = { id: string; filename?: string | null; content_type: string; size: number; content_disposition?: string | null; download_url?: string }

/** Nackte Adresse aus «Name <adresse>» oder «adresse», klein geschrieben. Massgebend ist die letzte
 *  spitze Klammer – eine im Anzeigenamen versteckte Adresse («"<anna@…>" <boese@…>») zählt nicht. */
function adresse(s: string): string {
  const auf = s.lastIndexOf('<')
  const zu = s.lastIndexOf('>')
  return (auf >= 0 && zu > auf ? s.slice(auf + 1, zu) : s).trim().toLowerCase()
}

/** Nur die Absender-Adresse aus den Einstellungen und die zusätzlich erlaubten. */
export function absenderErlaubt(from: string | null | undefined, s: { absender_email: string; beleg_absender?: string[] | null }): boolean {
  const von = adresse(from ?? '')
  if (!von) return false
  return [s.absender_email, ...(s.beleg_absender ?? [])].map(adresse).filter(Boolean).includes(von)
}

export function erlaubterAnhang(a: Pick<ResendAnhang, 'content_type' | 'size' | 'content_disposition'>): boolean {
  if (!(BELEG_TYPEN as readonly string[]).includes(a.content_type)) return false
  if (!(a.size > 0) || a.size > MAX_BELEG_BYTES) return false
  return !(a.content_disposition === 'inline' && a.content_type.startsWith('image/') && a.size < LOGO_GRENZE)
}

/** Dateiname für den Speicher: nur Buchstaben, Ziffern, Punkt, Bindestrich und Unterstrich, höchstens 80 Zeichen. */
export function sichererDateiname(name: string | null | undefined): string {
  const s = (name ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+/, '').replace(/-{2,}/g, '-')
  const kurz = s.length > 80 ? s.slice(s.length - 80).replace(/^[-.]+/, '') : s
  return kurz || 'beleg'
}

/** Server, von denen Resend Anhänge eingegangener Mails ausliefert (Stand 11/2026: cdn.resend.app) */
const RESEND_DOWNLOAD_HOSTS = ['cdn.resend.app', 'inbound-cdn.resend.com']

/** Download nur von Resends Servern für eingehende Anhänge (kein Abruf beliebiger Adressen). */
export function istResendDownload(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && RESEND_DOWNLOAD_HOSTS.includes(u.hostname)
  } catch {
    return false
  }
}

/** Nach dem Speichern aus dem Eingang: Datei löschen, wenn die Ausgabe einen anderen oder keinen Beleg bekommen hat. */
export function eingangDateiLoeschen(eingangPath: string | null, gespeichertPath: string | null | undefined): boolean {
  return Boolean(eingangPath) && eingangPath !== (gespeichertPath || null)
}
