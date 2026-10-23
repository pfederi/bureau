/** Kundenlink-Pfade, ohne Node-Abhängigkeiten (auch im Browser nutzbar). */
export function isPortalToken(s: string): boolean {
  return /^[A-Za-z0-9_-]{32}$/.test(s)
}

export function portalPath(token: string): string {
  return `/kunde/${token}`
}

/**
 * Name im Kopf und Titel der Kundenseite: fester Name der Edition, sonst der
 * Absender aus den Einstellungen. null, wenn beides fehlt.
 */
export function portalAnbieter(portalName: string | null, absenderName: string | null | undefined): string | null {
  return portalName ?? (absenderName?.trim() || null)
}
