import { describe, it, expect } from 'vitest'
import { addressLines, streetLine, addressInline } from '@/lib/address'

const muster = 'Muster AG\nAnna Muster / Kostenstelle 12345\r\nBuchhaltung\n  Beispielstrasse 5 \n'

describe('address', () => {
  it('splits a multi-line address and drops empty lines', () => {
    expect(addressLines(muster)).toEqual(['Muster AG', 'Anna Muster / Kostenstelle 12345', 'Buchhaltung', 'Beispielstrasse 5'])
    expect(addressLines(null)).toEqual([])
  })
  it('uses the last line as street for the QR bill', () => {
    expect(streetLine(muster)).toBe('Beispielstrasse 5')
    expect(streetLine('Musterweg 12')).toBe('Musterweg 12')
    expect(streetLine('')).toBe('')
    expect(streetLine('x'.repeat(80)).length).toBe(70)
  })
  it('joins lines for one-line display', () => {
    expect(addressInline('Abteilung\nStrasse 1')).toBe('Abteilung, Strasse 1')
  })
})
