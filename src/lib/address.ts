/**
 * Kundenadresse kann mehrzeilig sein (z. B. Abteilung, z. H., Kostenstelle, Strasse).
 * Im PDF stehen alle Zeilen, der QR-Zahlteil kennt nur eine Adresszeile: die letzte (Strasse).
 */
export function addressLines(adresse: string | null | undefined): string[] {
  return (adresse ?? '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
}

/** Strasse und Hausnummer für den QR-Zahlteil (letzte Zeile, max. 70 Zeichen). */
export function streetLine(adresse: string | null | undefined): string {
  const lines = addressLines(adresse)
  return (lines[lines.length - 1] ?? '').slice(0, 70)
}

/** Einzeilige Darstellung, z. B. für Listen. */
export function addressInline(adresse: string | null | undefined): string {
  return addressLines(adresse).join(', ')
}
