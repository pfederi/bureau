import { randomBytes } from 'crypto'

/**
 * Kundenlink: 24 zufällige Bytes (192 Bit) als URL-sicherer Text (32 Zeichen). Wer den Link
 * hat, sieht die Kundenseite; darum nur auf Knopfdruck erstellt und jederzeit widerrufbar.
 */
export function newPortalToken(): string {
  return randomBytes(24).toString('base64url')
}
