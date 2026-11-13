import { randomUUID } from 'node:crypto'
import { belegAuslesen } from '@/lib/expenses/auslesen'
import { eingangVorhanden, ladeEingangDatei, loescheEingangDatei, speichereEingang } from '@/lib/db/belegEingang'
import { abrufMitWiederholung, anhaengeFehlerHinweis, ladeMitGrenze } from './download'
import { erlaubterAnhang, istResendDownload, MAX_ANHAENGE, MAX_BELEG_BYTES, sichererDateiname, type ResendAnhang } from './belege'

/** Lädt die Anhänge einer eingegangenen Mail, liest sie aus und legt sie in den Eingang. Fehler pro Anhang werden geloggt. */
export async function verarbeiteBelegMail(mail: { id: string; absender: string; betreff: string | null }): Promise<void> {
  // Direkt nach dem Webhook ist die Mail bei Resend manchmal noch nicht abrufbar: bei 404/5xx kurz warten und nochmals
  const res = await abrufMitWiederholung(() => fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(mail.id)}/attachments?limit=100`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY?.trim() ?? ''}` },
  }))
  // Ohne verwertbaren Anhang trotzdem einen Eintrag mit Hinweis, damit die Mail nicht spurlos verschwindet
  const ohneBeleg = (hinweis: string) => speichereEingang({
    mail_id: mail.id, anhang_id: 'keine', absender: mail.absender, betreff: mail.betreff,
    beleg_path: null, beleg_name: null, vorschlag: {}, hinweis,
  }).catch(e => { console.error('[belege per mail] Hinweis nicht gespeichert', e); return false })
  if (!res.ok) {
    console.error('[belege per mail] Anhänge nicht geladen', res.status)
    await ohneBeleg(anhaengeFehlerHinweis(res.status))
    return
  }
  const liste = ((await res.json()) as { data?: ResendAnhang[] }).data ?? []
  const verwertbar = liste.filter(erlaubterAnhang).slice(0, MAX_ANHAENGE)
  if (verwertbar.length === 0) {
    await ohneBeleg(liste.length > 0
      ? 'Kein verwertbarer Anhang (nur PDF, JPG, PNG oder WEBP bis 10 MB).'
      : 'Die Mail hatte keinen Anhang.')
    return
  }
  let erledigt = 0
  for (const a of verwertbar) {
    let path: string | null = null
    try {
      if (await eingangVorhanden(mail.id, a.id)) { erledigt++; continue }
      if (!istResendDownload(a.download_url)) { console.error('[belege per mail] Download-Server nicht erlaubt:', a.download_url ? new URL(a.download_url).hostname : '–'); continue }
      const dl = await fetch(a.download_url as string, { redirect: 'error' })
      if (!dl.ok) throw new Error(`Download ${dl.status}`)
      // Grösse beim Lesen begrenzen, nicht erst danach (Resends Angabe allein genügt nicht)
      const bytes = await ladeMitGrenze(dl, MAX_BELEG_BYTES)
      if (!bytes) continue
      path = `eingang/${randomUUID()}-${sichererDateiname(a.filename)}`
      await ladeEingangDatei(path, bytes, a.content_type)
      const { vorschlag, hinweis } = await belegAuslesen(bytes, a.content_type)
      const neu = await speichereEingang({
        mail_id: mail.id, anhang_id: a.id, absender: mail.absender, betreff: mail.betreff,
        beleg_path: path, beleg_name: (a.filename ?? '').slice(0, 200) || 'Beleg', vorschlag, hinweis,
      })
      if (!neu) await loescheEingangDatei(path)
      erledigt++
    } catch (e) {
      console.error('[belege per mail] Anhang nicht verarbeitet', e)
      if (path) await loescheEingangDatei(path).catch(() => null)
    }
  }
  // Kein einziger Anhang liess sich verarbeiten: sichtbar machen statt still verschwinden lassen
  if (erledigt === 0) await ohneBeleg('Die Anhänge dieser Mail konnten nicht verarbeitet werden. Bitte nochmals weiterleiten oder den Beleg direkt erfassen.')
}
