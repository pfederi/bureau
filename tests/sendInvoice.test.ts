import { describe, it, expect, afterEach, vi } from 'vitest'
import { buildInvoiceEmail, buildReminderEmail, buildQuoteEmail, sendEmail, mailConfigured } from '@/lib/email/sendInvoice'

describe('buildInvoiceEmail', () => {
  it('assembles recipient, subject and attachment', () => {
    const msg = buildInvoiceEmail({
      toEmail: 'kunde@example.ch',
      fromEmail: 'Anna Muster <anna@example.ch>',
      rechnungsnummer: 'RE-2025-JAN-15-0007',
      fileBase: 'RE-2025-JAN-15-0007_Muster-AG',
      absenderName: 'Anna Muster',
      pdf: Buffer.from('%PDF-1.4 test'),
    })
    expect(msg.to).toBe('kunde@example.ch')
    expect(msg.subject).toContain('RE-2025-JAN-15-0007')
    expect(msg.attachments[0].filename).toBe('RE-2025-JAN-15-0007_Muster-AG.pdf')
  })
})

describe('sendEmail', () => {
  it('fails with a clear message when RESEND_API_KEY is missing', async () => {
    const prev = process.env.RESEND_API_KEY
    delete process.env.RESEND_API_KEY
    try {
      await expect(sendEmail({
        toEmail: 'kunde@example.ch',
        fromEmail: 'a@example.ch',
        rechnungsnummer: 'RE-1',
        fileBase: 'RE-1',
        absenderName: 'X',
        pdf: Buffer.from(''),
      })).rejects.toThrow('RESEND_API_KEY ist nicht gesetzt')
    } finally {
      if (prev !== undefined) process.env.RESEND_API_KEY = prev
    }
  })
})

const base = {
  toEmail: 'kunde@example.ch',
  fromEmail: 'Anna Muster <anna@example.ch>',
  fileBase: 'X',
  absenderName: 'Anna Muster',
  pdf: Buffer.from('%PDF'),
}

describe('copy to sender', () => {
  it('adds a BCC only when a copy address is set', () => {
    expect(buildInvoiceEmail({ ...base, rechnungsnummer: 'RE-1', bccEmail: 'anna@example.ch' }).bcc).toBe('anna@example.ch')
    expect(buildInvoiceEmail({ ...base, rechnungsnummer: 'RE-1' })).not.toHaveProperty('bcc')
  })
})

describe('buildReminderEmail', () => {
  it('names invoice, date and amount', () => {
    const msg = buildReminderEmail({ ...base, rechnungsnummer: 'RE-7', rechnungsdatum: '2026-09-10', betrag: 1429 })
    expect(msg.subject).toBe('Zahlungserinnerung: Rechnung RE-7')
    expect(msg.html).toContain('vom 10.09.2026')
    expect(msg.html).toContain('Fr.\u00A01429.00')
  })
})

describe('buildQuoteEmail', () => {
  it('mentions the validity date when set', () => {
    const msg = buildQuoteEmail({ ...base, offertnummer: 'OF-1', gueltigBis: '2026-11-30' })
    expect(msg.subject).toBe('Offerte OF-1')
    expect(msg.html).toContain('gültig bis 30.11.2026')
  })
})

describe('mail HTML escaping', () => {
  it('escapes names and numbers in the HTML body', () => {
    const msg = buildInvoiceEmail({ toEmail: 'a@example.ch', fromEmail: 'x@example.ch', fileBase: 'f', absenderName: 'Max <b>Muster</b> & Co', pdf: Buffer.from(''), rechnungsnummer: 'RE-1<script>' })
    expect(msg.html).toContain('Max &lt;b&gt;Muster&lt;/b&gt; &amp; Co')
    expect(msg.html).toContain('RE-1&lt;script&gt;')
    expect(msg.html).not.toContain('<script>')
  })
})

describe('mailConfigured', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('ist true mit RESEND_API_KEY', () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    expect(mailConfigured()).toBe(true)
  })
  it('ist false ohne oder mit leerem Schlüssel', () => {
    vi.stubEnv('RESEND_API_KEY', '')
    expect(mailConfigured()).toBe(false)
    vi.stubEnv('RESEND_API_KEY', '   ')
    expect(mailConfigured()).toBe(false)
  })
})
