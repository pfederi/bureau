import { after, type NextRequest, NextResponse } from 'next/server'
import { verifyWebhook } from '@/lib/inbound/signatur'
import { absenderErlaubt } from '@/lib/inbound/belege'
import { belegEinstellungen } from '@/lib/db/belegEingang'
import { verarbeiteBelegMail } from '@/lib/inbound/verarbeiten'
import { mailConfigured } from '@/lib/email/sendInvoice'

export const dynamic = 'force-dynamic'

const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/** Resend Inbound: weitergeleitete Belege. Öffentlich, nur mit gültiger Webhook-Signatur und von erlaubten Absendern. */
export async function POST(req: NextRequest) {
  const body = await req.text()
  const ok = verifyWebhook(body, {
    id: req.headers.get('svix-id'), timestamp: req.headers.get('svix-timestamp'), signature: req.headers.get('svix-signature'),
  }, process.env.RESEND_WEBHOOK_SECRET)
  if (!ok) return json({ error: 'Ungültige Signatur.' }, 401)
  if (!mailConfigured()) return json({ error: 'Mailversand (RESEND_API_KEY) ist nicht eingerichtet.' }, 503)

  let event: { type?: string; data?: { email_id?: unknown; from?: unknown; subject?: unknown } }
  try { event = JSON.parse(body) } catch { return json({ error: 'Ungültiger Inhalt.' }, 400) }
  if (event.type !== 'email.received' || typeof event.data?.email_id !== 'string') return json({ ok: true, ignoriert: true })

  const from = typeof event.data.from === 'string' ? event.data.from : ''
  if (!absenderErlaubt(from, await belegEinstellungen())) {
    console.info('[belege per mail] Absender nicht erlaubt, verworfen:', from.split('@')[1] ?? '?')
    return json({ ok: true, ignoriert: true })
  }
  const mail = {
    id: event.data.email_id,
    absender: from.slice(0, 200),
    betreff: typeof event.data.subject === 'string' ? event.data.subject.slice(0, 300) : null,
  }
  after(() => verarbeiteBelegMail(mail).catch(e => console.error('[belege per mail]', e)))
  return json({ ok: true })
}
