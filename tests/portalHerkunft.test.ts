import { describe, it, expect } from 'vitest'
import { gleicheHerkunft } from '@/lib/portal/herkunft'

describe('gleicheHerkunft', () => {
  it('ohne Origin entscheidet das Token', () => {
    expect(gleicheHerkunft(null, 'example.ch', null)).toBe(true)
  })
  it('Host oder erster weitergeleiteter Host muss passen', () => {
    expect(gleicheHerkunft('https://example.ch', 'example.ch', null)).toBe(true)
    expect(gleicheHerkunft('https://example.ch', 'localhost:3000', 'example.ch, proxy.intern')).toBe(true)
    expect(gleicheHerkunft('https://boese.example', 'example.ch', 'example.ch')).toBe(false)
    expect(gleicheHerkunft('null', 'example.ch', null)).toBe(false)
  })
})
