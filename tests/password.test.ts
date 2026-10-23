import { describe, it, expect } from 'vitest'
import { validateNewPassword, MIN_PASSWORD_LENGTH } from '@/lib/password'

const gut = 'Beispielweg-53!'

describe('validateNewPassword', () => {
  it('accepts a long, matching, new password', () => {
    expect(validateNewPassword('alt-passwort', gut, gut)).toBeNull()
  })
  it('requires the current password', () => {
    expect(validateNewPassword('', gut, gut)).toMatch(/aktuelles Passwort/)
  })
  it('requires a minimum length', () => {
    const kurz = 'x'.repeat(MIN_PASSWORD_LENGTH - 1)
    expect(validateNewPassword('alt-passwort', kurz, kurz)).toMatch(/mindestens/)
  })
  it('requires both new passwords to match', () => {
    expect(validateNewPassword('alt-passwort', gut, gut + 'x')).toMatch(/nicht überein/)
  })
  it('rejects the current password as the new one', () => {
    expect(validateNewPassword(gut, gut, gut)).toMatch(/unterscheiden/)
  })
})
