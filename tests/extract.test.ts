import { describe, it, expect } from 'vitest'
import { parseExtraction } from '@/lib/expenses/extract'

describe('parseExtraction', () => {
  it('reads a clean JSON answer', () => {
    expect(parseExtraction('{"datum":"2026-10-15","betrag":64.90,"waehrung":"EUR","lieferant":"Musterhost GmbH","beschreibung":"Musterhost Cloud-Server, Rechnung 080000012345","kategorie":"hosting"}'))
      .toEqual({ datum: '2026-10-15', betrag: 64.90, waehrung: 'EUR', lieferant: 'Musterhost GmbH', beschreibung: 'Musterhost Cloud-Server, Rechnung 080000012345', kategorie: 'hosting' })
  })

  it('tolerates a thinking block, surrounding text and Swiss/German number formats', () => {
    const r = parseExtraction('<think>hmm</think> Hier: {"datum":"5.4.2026","betrag":"1\'234,50 €","waehrung":"€"} fertig')
    expect(r).toEqual({ datum: '2026-04-05', betrag: 1234.5, waehrung: 'EUR' })
    expect(parseExtraction('{"betrag":"1,234.50","waehrung":"usd"}')).toEqual({ betrag: 1234.5, waehrung: 'USD' })
  })

  it('drops implausible values instead of guessing', () => {
    expect(parseExtraction('{"datum":"2026-02-31","betrag":-5,"waehrung":"GBP","kategorie":"essen"}')).toEqual({})
    expect(parseExtraction('kein JSON')).toEqual({})
  })
})
