/**
 * Gleiche Herkunft für öffentliche Schreib-Routen: fehlt Origin (z. B. ältere Browser), entscheidet das Token;
 * sonst muss der Host dem Host-Header oder dem ersten weitergeleiteten Host (hinter Proxys eine Liste) entsprechen.
 */
export function gleicheHerkunft(origin: string | null, host: string | null, forwardedHost: string | null): boolean {
  if (!origin) return true
  try {
    const von = new URL(origin).host
    const weitergeleitet = forwardedHost?.split(',')[0]?.trim() || null
    return von === host || von === weitergeleitet
  } catch {
    return false
  }
}
