import { describe, it, expect } from 'vitest'
import { isProtectedPath, adminStep, adminRedirect, jwtAal, LOGIN_PATH, MFA_SETUP_PATH } from '@/lib/auth'

describe('isProtectedPath', () => {
  it('protects admin routes', () => {
    expect(isProtectedPath('/admin')).toBe(true)
    expect(isProtectedPath('/admin/rechnungen')).toBe(true)
  })
  it('allows the login page', () => {
    expect(isProtectedPath('/admin/login')).toBe(false)
  })
  it('protects admin api routes', () => {
    expect(isProtectedPath('/api/admin/projects/upload')).toBe(true)
  })
  it('ignores public routes', () => {
    expect(isProtectedPath('/')).toBe(false)
    expect(isProtectedPath('/projects')).toBe(false)
    expect(isProtectedPath('/api/time-entries')).toBe(false)
  })
})

const verified = { factors: [{ status: 'verified' }] } as any
const none = { factors: [] } as any

describe('adminStep', () => {
  it('requires a login first', () => {
    expect(adminStep({ user: null, aal: null, isAdmin: false })).toBe('anmelden')
  })
  it('blocks users who are not on the admin list', () => {
    expect(adminStep({ user: verified, aal: 'aal2', isAdmin: false })).toBe('kein-zugriff')
  })
  it('forces setup without a verified factor', () => {
    expect(adminStep({ user: none, aal: 'aal1', isAdmin: true })).toBe('einrichten')
    expect(adminStep({ user: { factors: [{ status: 'unverified' }] } as any, aal: 'aal1', isAdmin: true })).toBe('einrichten')
  })
  it('asks for the code until the session is aal2', () => {
    expect(adminStep({ user: verified, aal: 'aal1', isAdmin: true })).toBe('code')
    expect(adminStep({ user: verified, aal: 'aal2', isAdmin: true })).toBe('ok')
  })
})

describe('adminRedirect', () => {
  it('sends unfinished logins to the login page', () => {
    expect(adminRedirect('/admin/rechnungen', 'anmelden')).toBe(LOGIN_PATH)
    expect(adminRedirect('/admin/rechnungen', 'code')).toBe(LOGIN_PATH)
    expect(adminRedirect('/api/admin/expenses/upload', 'kein-zugriff')).toBe(LOGIN_PATH)
    expect(adminRedirect(MFA_SETUP_PATH, 'code')).toBe(LOGIN_PATH)
  })
  it('sends admins without a factor to the setup', () => {
    expect(adminRedirect('/admin', 'einrichten')).toBe(MFA_SETUP_PATH)
    expect(adminRedirect(LOGIN_PATH, 'einrichten')).toBe(MFA_SETUP_PATH)
    expect(adminRedirect(MFA_SETUP_PATH, 'einrichten')).toBeNull()
  })
  it('keeps the login page for the code step', () => {
    expect(adminRedirect(LOGIN_PATH, 'anmelden')).toBeNull()
    expect(adminRedirect(LOGIN_PATH, 'code')).toBeNull()
  })
  it('lets finished logins through and skips the auth pages', () => {
    expect(adminRedirect('/admin/rechnungen', 'ok')).toBeNull()
    expect(adminRedirect(LOGIN_PATH, 'ok')).toBe('/admin')
    expect(adminRedirect(MFA_SETUP_PATH, 'ok')).toBe('/admin')
  })
  it('ignores public pages', () => {
    expect(adminRedirect('/', 'anmelden')).toBeNull()
  })
})

describe('jwtAal', () => {
  const token = (payload: object) =>
    `x.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.y`
  it('reads the assurance level from the token', () => {
    expect(jwtAal(token({ aal: 'aal2', sub: 'ü?>' }))).toBe('aal2')
    expect(jwtAal(token({ aal: 'aal1' }))).toBe('aal1')
  })
  it('returns null for missing or broken tokens', () => {
    expect(jwtAal(undefined)).toBeNull()
    expect(jwtAal('kaputt')).toBeNull()
    expect(jwtAal('x.%%%.y')).toBeNull()
    expect(jwtAal(token({}))).toBeNull()
  })
})
