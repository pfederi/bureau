import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { verifyWebhook } from '@/lib/inbound/signatur'

const roh = Buffer.from('testgeheimnis-1234567890')
const secret = `whsec_${roh.toString('base64')}`
const jetzt = 1_800_000_000_000
const ts = String(Math.floor(jetzt / 1000))
const body = '{"type":"email.received","data":{"email_id":"m1"}}'
const sign = (b: string, t = ts, key = roh) => `v1,${createHmac('sha256', key).update(`msg_1.${t}.${b}`).digest('base64')}`
const h = (signature: string, timestamp = ts) => ({ id: 'msg_1', timestamp, signature })

describe('verifyWebhook', () => {
  it('akzeptiert eine gültige Signatur, auch unter mehreren', () => {
    expect(verifyWebhook(body, h(sign(body)), secret, jetzt)).toBe(true)
    expect(verifyWebhook(body, h(`v1,AAAA ${sign(body)}`), secret, jetzt)).toBe(true)
  })
  it('lehnt falsches Geheimnis, veränderten Body und fehlende Angaben ab', () => {
    expect(verifyWebhook(body, h(sign(body, ts, Buffer.from('anderes'))), secret, jetzt)).toBe(false)
    expect(verifyWebhook(body + ' ', h(sign(body)), secret, jetzt)).toBe(false)
    expect(verifyWebhook(body, h(sign(body)), undefined, jetzt)).toBe(false)
    expect(verifyWebhook(body, { id: null, timestamp: ts, signature: sign(body) }, secret, jetzt)).toBe(false)
    expect(verifyWebhook(body, h('v2,irgendwas'), secret, jetzt)).toBe(false)
  })
  it('lehnt alte oder zukünftige Zeitstempel ab (5 Minuten)', () => {
    const alt = String(Math.floor(jetzt / 1000) - 301)
    expect(verifyWebhook(body, h(sign(body, alt), alt), secret, jetzt)).toBe(false)
    const knapp = String(Math.floor(jetzt / 1000) - 299)
    expect(verifyWebhook(body, h(sign(body, knapp), knapp), secret, jetzt)).toBe(true)
  })
  it('Geheimnis auch ohne whsec_-Präfix', () => {
    expect(verifyWebhook(body, h(sign(body)), roh.toString('base64'), jetzt)).toBe(true)
  })
})
