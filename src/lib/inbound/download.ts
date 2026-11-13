/**
 * Liest eine Antwort höchstens bis `max` Bytes: zu grosse Content-Length bricht sofort ab, sonst wird
 * der Strom gezählt und beim Überschreiten abgebrochen. null = zu gross oder leer.
 */
export async function ladeMitGrenze(res: Response, max: number): Promise<Uint8Array | null> {
  const angegeben = Number(res.headers.get('content-length'))
  if (Number.isFinite(angegeben) && angegeben > max) { await res.body?.cancel(); return null }
  if (!res.body) return null
  const reader = res.body.getReader()
  const teile: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > max) { await reader.cancel(); return null }
    teile.push(value)
  }
  if (total === 0) return null
  const out = new Uint8Array(total)
  let pos = 0
  for (const t of teile) { out.set(t, pos); pos += t.length }
  return out
}

const warten = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

/**
 * Ruft `abruf` auf und wiederholt bei 404 (Mail bei Resend noch nicht abrufbar) oder 5xx nach den
 * angegebenen Wartezeiten. Andere Fehler (z. B. 401/403) werden nicht wiederholt.
 */
export async function abrufMitWiederholung(
  abruf: () => Promise<Response>,
  wartezeiten: number[] = [3000, 8000, 20000],
  schlafen: (ms: number) => Promise<void> = warten,
): Promise<Response> {
  let res = await abruf()
  for (const ms of wartezeiten) {
    if (res.status !== 404 && res.status < 500) return res
    await res.body?.cancel()
    await schlafen(ms)
    res = await abruf()
  }
  return res
}

/** Verständlicher Hinweis im Eingang, wenn Resend die Anhänge nicht liefert. */
export function anhaengeFehlerHinweis(status: number): string {
  if (status === 401 || status === 403) return 'Resend hat den Abruf abgelehnt: Der API-Schlüssel auf dem Server hat keine Leserechte (Full access nötig).'
  if (status === 404) return 'Resend hat die Mail nicht gefunden. Gehört der API-Schlüssel auf dem Server zum selben Resend-Team wie der Empfang?'
  return 'Die Anhänge konnten nicht geladen werden (Störung bei Resend). Bitte später nochmals weiterleiten.'
}
