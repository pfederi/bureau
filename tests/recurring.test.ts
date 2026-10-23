import { describe, it, expect } from 'vitest'
import { findMissingRecurring, cleanDescription, seriesKey, hideId } from '@/lib/expenses/recurring'

type E = Parameters<typeof findMissingRecurring>[0][number]
const ex = (datum: string, beschreibung: string, p: Partial<E> = {}): E => ({
  datum, beschreibung, lieferant: 'cyon GmbH', kategorie: 'hosting', waehrung: 'CHF', betrag: 24.9, betrag_original: null, ...p,
})
const cloud = (datum: string) => ex(datum, `Musterhost Cloud-Server, Rechnung 08${datum.replace(/-/g, '')}1`, {
  lieferant: 'Musterhost GmbH', waehrung: 'EUR', betrag: 66, betrag_original: 64.90,
})
const today = new Date('2026-10-21T12:00:00Z')

describe('cleanDescription / seriesKey', () => {
  it('removes invoice numbers', () => {
    expect(cleanDescription('Musterhost Cloud-Server, Rechnung 080000012345')).toBe('Musterhost Cloud-Server')
    expect(cleanDescription('Domain muster.ch, Rechnung 2992754')).toBe('Domain muster.ch')
  })
  it('ignores the legal form of the supplier', () => {
    expect(seriesKey({ lieferant: 'cyon GmbH', beschreibung: 'Domain x.ch' })).toBe(seriesKey({ lieferant: 'cyon AG', beschreibung: 'Domain x.ch, Rechnung 123456' }))
  })
})

describe('findMissingRecurring', () => {
  it('reports a yearly domain whose renewal is overdue', () => {
    const r = findMissingRecurring([
      ex('2024-05-24', 'Domain muster.ch, Rechnung 2722769'),
      ex('2025-05-26', 'Domain muster.ch, Rechnung 2992754', { lieferant: 'cyon AG' }),
    ], today)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ frequenz: 'jaehrlich', beschreibung: 'Domain muster.ch', erwartet: '2026-05-26', betrag: 24.9, letztes: '2025-05-26' })
  })
  it('stays quiet while a monthly invoice is not yet due', () => {
    expect(findMissingRecurring(['2026-07-05', '2026-08-05', '2026-09-05', '2026-10-15'].map(cloud), today)).toEqual([])
  })
  it('reports a missing monthly invoice after the grace period, with the original currency amount', () => {
    const r = findMissingRecurring(['2026-06-05', '2026-07-05', '2026-08-05'].map(cloud), today)
    expect(r[0]).toMatchObject({ frequenz: 'monatlich', erwartet: '2026-09-05', waehrung: 'EUR', betrag: 64.90 })
  })
  it('gives up on a series that stopped long ago (cancelled)', () => {
    expect(findMissingRecurring(['2025-01-05', '2025-02-05', '2025-03-05'].map(cloud), today)).toEqual([])
  })
  it('needs at least two entries and a regular interval', () => {
    expect(findMissingRecurring([ex('2025-04-14', 'Domain admin.example.ch')], today)).toEqual([])
    expect(findMissingRecurring([ex('2026-01-10', 'Kabel'), ex('2026-03-20', 'Kabel')], today)).toEqual([])
  })
  it('keeps month ends valid', () => {
    const r = findMissingRecurring(['2026-06-30', '2026-07-31', '2026-08-31'].map(cloud), today)
    expect(r[0].erwartet).toBe('2026-09-30')
  })
  it('skips hidden series until a newer receipt arrives', () => {
    const daten = ['2026-06-05', '2026-07-05', '2026-08-05']
    const [m] = findMissingRecurring(daten.map(cloud), today)
    expect(findMissingRecurring(daten.map(cloud), today, [hideId(m)])).toEqual([])
    // mit neuen Belegen gilt die Reihe wieder als aktiv und meldet sich beim nächsten Ausbleiben
    const spaeter = new Date('2026-11-20T12:00:00Z')
    expect(findMissingRecurring([...daten, '2026-09-05', '2026-10-05'].map(cloud), spaeter, [hideId(m)])).toHaveLength(1)
  })
})
