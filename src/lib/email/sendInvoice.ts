import { Resend } from 'resend'
import { formatDatum } from '@/lib/utils'
import { formatChf } from '@/lib/invoices/stats'

type MailBase = {
  toEmail: string
  fromEmail: string
  /** Kopie an den Absender (BCC); leer = keine Kopie */
  bccEmail?: string | null
  /** Dateiname des Anhangs ohne Endung */
  fileBase: string
  absenderName: string
  pdf: Buffer
}

export type BuildEmailInput = MailBase & { rechnungsnummer: string }
export type ReminderEmailInput = BuildEmailInput & { rechnungsdatum: string; betrag: number }
export type QuoteEmailInput = MailBase & { offertnummer: string; gueltigBis: string | null }

export type MailMessage = {
  from: string
  to: string
  bcc?: string
  subject: string
  html: string
  text?: string
  attachments: { filename: string; content: Buffer }[]
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Absätze sind reiner Text (Nummern, Namen, Beträge) und werden für HTML maskiert. */
function message(input: MailBase, subject: string, absätze: string[]): MailMessage {
  return {
    from: input.fromEmail,
    to: input.toEmail,
    ...(input.bccEmail ? { bcc: input.bccEmail } : {}),
    subject,
    html: [
      '<p>Guten Tag</p>',
      ...absätze.map(a => `<p>${esc(a)}</p>`),
      `<p>Freundliche Grüsse<br>${esc(input.absenderName)}</p>`,
    ].join(''),
    attachments: [{ filename: `${input.fileBase}.pdf`, content: input.pdf }],
  }
}

export function buildInvoiceEmail(input: BuildEmailInput): MailMessage {
  return message(input, `Rechnung ${input.rechnungsnummer}`, [
    `Im Anhang finden Sie die Rechnung ${input.rechnungsnummer}.`,
  ])
}

export function buildReminderEmail(input: ReminderEmailInput): MailMessage {
  return message(input, `Zahlungserinnerung: Rechnung ${input.rechnungsnummer}`, [
    `Gerne erinnere ich Sie an die Rechnung ${input.rechnungsnummer} vom ${formatDatum(input.rechnungsdatum)} über ${formatChf(input.betrag)}, die bei mir noch offen ist. Sie finden sie im Anhang nochmals.`,
    'Falls sich Ihre Zahlung mit dieser Nachricht gekreuzt hat, betrachten Sie diese Erinnerung bitte als gegenstandslos.',
  ])
}

export function buildQuoteEmail(input: QuoteEmailInput): MailMessage {
  return message(input, `Offerte ${input.offertnummer}`, [
    `Im Anhang finden Sie die Offerte ${input.offertnummer}${input.gueltigBis ? `, gültig bis ${formatDatum(input.gueltigBis)}` : ''}.`,
    'Bei Fragen melden Sie sich gerne.',
  ])
}

export type TimeReportEmailInput = MailBase & { monatLabel: string; stunden: string }

export function buildTimeReportEmail(input: TimeReportEmailInput): MailMessage {
  return message(input, `Stundenrapport ${input.monatLabel}`, [
    `Im Anhang finden Sie den Stundenrapport für ${input.monatLabel} (${input.stunden} Std.).`,
    'Bei Fragen melden Sie sich gerne.',
  ])
}

/** Mailversand eingerichtet (RESEND_API_KEY gesetzt)? Ohne Schlüssel laufen die Cron-Jobs ohne Mail. */
export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim())
}

/** Hinweis in der Antwort der Cron-Jobs, wenn kein Mailversand eingerichtet ist. */
export const MAIL_DEAKTIVIERT = 'Mail deaktiviert (RESEND_API_KEY fehlt)'

export async function sendMail(msg: MailMessage): Promise<void> {
  if (!mailConfigured()) throw new Error('RESEND_API_KEY ist nicht gesetzt (Umgebungsvariable des Servers).')
  const resend = new Resend(process.env.RESEND_API_KEY!.trim())
  const { error } = await resend.emails.send(msg)
  if (error) throw new Error(error.message)
}

export async function sendEmail(input: BuildEmailInput): Promise<void> {
  await sendMail(buildInvoiceEmail(input))
}

/** Absender und Kopie-Adresse aus den Einstellungen (Absender per Env überschreibbar). */
export function senderFor(settings: { absender_name: string; absender_email: string }) {
  return {
    fromEmail: process.env.INVOICE_FROM_EMAIL || `${settings.absender_name} <${settings.absender_email}>`,
    bccEmail: settings.absender_email,
    absenderName: settings.absender_name,
  }
}
