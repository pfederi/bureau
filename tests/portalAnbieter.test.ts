import { describe, it, expect } from 'vitest'
import { portalAnbieter } from '@/lib/portal/path'

describe('portalAnbieter', () => {
  it('nimmt den festen Namen der Edition, wenn gesetzt', () => {
    expect(portalAnbieter('Studio Muster', 'Anna Muster')).toBe('Studio Muster')
  })
  it('fällt ohne festen Namen auf den Absender zurück', () => {
    expect(portalAnbieter(null, ' Anna Muster ')).toBe('Anna Muster')
    expect(portalAnbieter(null, '')).toBeNull()
    expect(portalAnbieter(null, undefined)).toBeNull()
  })
})
