import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Cron-Jobs ohne Resend: laufen weiter, verschicken aber keine Mail.
const sendMail = vi.fn(async () => {})
const runSiteChecks = vi.fn()

const settings = { id: 1, absender_name: 'Anna Muster', absender_email: 'anna@example.ch', grenzsteuersatz: 25, belege_ausgeblendet: [] }
const site = { id: 's1', customer_id: 'c1', url: 'https://www.example.ch' }

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    from: (table: string) => ({
      select: () => {
        if (table === 'settings') return { eq: () => ({ single: async () => ({ data: settings, error: null }) }) }
        const data = table === 'monitored_sites' ? [site] : table === 'customers' ? [{ id: 'c1', firma_oder_name: 'Muster AG' }] : []
        return Promise.resolve({ data, error: null })
      },
    }),
  }),
}))
vi.mock('@/lib/monitoring/run', () => ({ runSiteChecks: (...a: unknown[]) => runSiteChecks(...a) }))
vi.mock('@/modules/material', () => ({ listCreditsFor: async () => [] }))
vi.mock('@/lib/email/sendInvoice', async orig => ({ ...(await orig<typeof import('@/lib/email/sendInvoice')>()), sendMail }))

const CRON = 'c'.repeat(24)
const anfrage = (pfad: string, auth = `Bearer ${CRON}`) => new NextRequest(`http://localhost${pfad}`, { headers: { authorization: auth } })

describe('Cron-Jobs ohne Mailversand', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', CRON)
    sendMail.mockClear()
    runSiteChecks.mockReset()
    runSiteChecks.mockResolvedValue([{ site, ereignis: 'ausfall', fehler: 'HTTP 502' }])
  })
  afterEach(() => vi.unstubAllEnvs())

  it('prüft die Berechtigung zuerst', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const { GET } = await import('@/app/api/cron/ueberwachung/route')
    const res = await GET(anfrage('/api/cron/ueberwachung', 'Bearer falsch'))
    expect(res.status).toBe(401)
    expect(runSiteChecks).not.toHaveBeenCalled()
  })

  it('Überwachung prüft und speichert, verschickt aber keine Mail', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const { GET } = await import('@/app/api/cron/ueberwachung/route')
    const res = await GET(anfrage('/api/cron/ueberwachung'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, hinweis: 'Mail deaktiviert (RESEND_API_KEY fehlt)', geprueft: 1 })
    expect(runSiteChecks).toHaveBeenCalledOnce()
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('Überwachung meldet mit Resend wie bisher per Mail', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    const { GET } = await import('@/app/api/cron/ueberwachung/route')
    const res = await GET(anfrage('/api/cron/ueberwachung'))
    expect(res.status).toBe(200)
    expect(await res.json()).not.toHaveProperty('hinweis')
    expect(sendMail).toHaveBeenCalledOnce()
  })

  it('Wochenmail wird ohne Resend nicht verschickt', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const { GET } = await import('@/app/api/cron/wochenmail/route')
    const res = await GET(anfrage('/api/cron/wochenmail'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, hinweis: 'Mail deaktiviert (RESEND_API_KEY fehlt)' })
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('Wochenmail geht mit Resend wie bisher an den Absender', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    const { GET } = await import('@/app/api/cron/wochenmail/route')
    const res = await GET(anfrage('/api/cron/wochenmail'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, an: 'anna@example.ch' })
    expect(sendMail).toHaveBeenCalledOnce()
  })
})
