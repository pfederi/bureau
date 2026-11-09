import { describe, it, expect } from 'vitest'
import { adminHostRedirect, passkeyRpId } from '@/lib/adminHost'

describe('adminHostRedirect', () => {
  it('führt auf der Admin-Adresse von / zum Admin', () => {
    expect(adminHostRedirect('bureau.example.ch', '/', 'bureau.example.ch')).toBe('/admin')
  })
  it('ignoriert Gross-/Kleinschreibung, Port und Protokoll in der Einstellung', () => {
    expect(adminHostRedirect('Bureau.Example.ch:443', '/', 'https://bureau.example.ch/')).toBe('/admin')
  })
  it('lässt andere Pfade und Adressen in Ruhe', () => {
    expect(adminHostRedirect('bureau.example.ch', '/admin', 'bureau.example.ch')).toBeNull()
    expect(adminHostRedirect('bureau.example.ch', '/kunde/abc', 'bureau.example.ch')).toBeNull()
    expect(adminHostRedirect('example.ch', '/', 'bureau.example.ch')).toBeNull()
    expect(adminHostRedirect('evil-bureau.example.ch', '/', 'bureau.example.ch')).toBeNull()
  })
  it('macht ohne Einstellung oder Host nichts', () => {
    expect(adminHostRedirect('bureau.example.ch', '/', undefined)).toBeNull()
    expect(adminHostRedirect('bureau.example.ch', '/', '')).toBeNull()
    expect(adminHostRedirect(null, '/', 'bureau.example.ch')).toBeNull()
  })
})

describe('passkeyRpId', () => {
  it('nimmt auf Domain und Subdomains die Domain', () => {
    expect(passkeyRpId('example.ch', 'example.ch')).toBe('example.ch')
    expect(passkeyRpId('bureau.example.ch', 'example.ch')).toBe('example.ch')
  })
  it('bleibt sonst beim Standard', () => {
    expect(passkeyRpId('localhost', 'example.ch')).toBeUndefined()
    expect(passkeyRpId('notexample.ch', 'example.ch')).toBeUndefined()
    expect(passkeyRpId('example.ch', null)).toBeUndefined()
  })
})
