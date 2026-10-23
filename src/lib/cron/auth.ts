import { timingSafeEqual } from 'crypto'

/** Nur mit `Authorization: Bearer <CRON_SECRET>` (geplante Aufgaben in Coolify). */
export function cronAuthorized(authorization: string | null): boolean {
  const secret = process.env.CRON_SECRET
  const given = authorization?.replace(/^Bearer\s+/i, '') ?? ''
  if (!secret || secret.length < 16 || given.length !== secret.length) return false
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret))
}
