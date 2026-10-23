import { describe, it, expect, afterEach, vi } from 'vitest'
import { edition } from '@/edition'
import { appUrl } from '@/lib/appUrl'

describe('edition', () => {
  it('hat alle Felder', () => {
    expect(Object.keys(edition).sort()).toEqual(
      ['adminTitel', 'domain', 'favicon', 'htmlLang', 'logo', 'material', 'name', 'portalName', 'releaseNotes', 'slug', 'website'].sort(),
    )
    expect(edition.slug).toMatch(/^[a-z0-9-]+$/)
  })
})

describe('appUrl', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('nimmt APP_URL ohne Schrägstrich am Ende', () => {
    vi.stubEnv('APP_URL', 'https://admin.example.ch/')
    expect(appUrl()).toBe('https://admin.example.ch')
  })
  it('fällt auf die Domain der Edition zurück, sonst localhost', () => {
    vi.stubEnv('APP_URL', '')
    expect(appUrl()).toBe(edition.domain ? `https://${edition.domain}` : 'http://localhost:3000')
  })
})
