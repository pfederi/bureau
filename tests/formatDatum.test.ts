import { describe, it, expect } from 'vitest'
import { formatDatum } from '@/lib/utils'

describe('formatDatum', () => {
  it('formats ISO dates Swiss style', () => {
    expect(formatDatum('2026-10-07')).toBe('07.10.2026')
  })

  it('uses the date part of timestamps', () => {
    expect(formatDatum('2026-07-27T06:55:41.218+00:00')).toBe('27.07.2026')
  })

  it('leaves free text and empty values alone', () => {
    expect(formatDatum('2024')).toBe('2024')
    expect(formatDatum(null)).toBe('')
  })
})

import { displayFirstName } from '@/lib/utils'

describe('displayFirstName', () => {
  it('prefers the profile, then the sender name, then the e-mail', () => {
    expect(displayFirstName({ full_name: 'Anna Muster' }, 'Beat Beispiel', 'x@example.ch')).toBe('Anna')
    expect(displayFirstName({}, 'Anna Muster', 'x@example.ch')).toBe('Anna')
    expect(displayFirstName(null, '', 'anna@example.ch')).toBe('Anna')
  })
})
