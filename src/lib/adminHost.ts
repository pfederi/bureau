/** Hostname ohne Protokoll, Port und Schrägstrich, klein geschrieben. */
function hostname(wert: string): string {
  return wert.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/:].*$/, '')
}

/**
 * Eigene Adresse für den Admin (ADMIN_HOST, z. B. bureau.example.ch): Dort führt `/`
 * direkt zum Admin statt zur Website. Gibt das Ziel zurück, null = bleiben.
 */
export function adminHostRedirect(host: string | null, pathname: string, adminHost: string | undefined): string | null {
  if (!host || !adminHost || pathname !== '/') return null
  return hostname(host) === hostname(adminHost) ? '/admin' : null
}

/**
 * Relying Party für Passkeys: auf der eigenen Domain und ihren Subdomains die Domain selbst,
 * damit ein Passkey auf beiden Adressen gilt. undefined = Standard (aktueller Hostname).
 */
export function passkeyRpId(host: string, domain: string | null): string | undefined {
  if (!domain) return undefined
  const h = hostname(host)
  return h === domain || h.endsWith(`.${domain}`) ? domain : undefined
}
