import { createHmac, timingSafeEqual } from 'node:crypto'

const TOLERANZ_S = 5 * 60

/**
 * Prüft die Signatur eines Resend-Webhooks (Svix-Standard): HMAC-SHA256 über `${id}.${timestamp}.${body}`
 * mit dem base64-Geheimnis (`whsec_…`); der Header enthält eine oder mehrere `v1,<base64>`.
 * Zeitstempel höchstens 5 Minuten alt oder voraus (Schutz vor Wiederholung).
 */
export function verifyWebhook(
  body: string,
  h: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string | undefined,
  jetzt: number = Date.now(),
): boolean {
  if (!secret || !h.id || !h.timestamp || !h.signature) return false
  const ts = Number(h.timestamp)
  if (!Number.isFinite(ts) || Math.abs(jetzt / 1000 - ts) > TOLERANZ_S) return false
  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64')
  if (key.length === 0) return false
  const erwartet = createHmac('sha256', key).update(`${h.id}.${h.timestamp}.${body}`).digest()
  return h.signature.split(' ').some(teil => {
    const [version, sig] = teil.split(',')
    if (version !== 'v1' || !sig) return false
    const b = Buffer.from(sig, 'base64')
    return b.length === erwartet.length && timingSafeEqual(b, erwartet)
  })
}
