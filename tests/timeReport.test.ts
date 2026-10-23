import { describe, it, expect } from 'vitest'
import { buildTimeReport, defaultReportMonth, isMonth, monthLabel, reportMonths, timeReportFileBase } from '@/lib/timeEntries/report'
import { isPortalToken, portalPath } from '@/lib/portal/path'
import { newPortalToken } from '@/lib/portal/token'

const e = (datum: string, stunden: number, projekt: string | null = null) => ({ datum, beschreibung: `Arbeit ${datum}`, stunden, projekt })

describe('time report', () => {
  const entries = [e('2026-09-03', 2, 'Relaunch 2026'), e('2026-09-01', 1.5, 'Shop'), e('2026-08-20', 3), e('2026-09-15', 0.25, 'Relaunch 2026')]
  it('lists months with entries, newest first', () => {
    expect(reportMonths(entries)).toEqual([
      { monat: '2026-09', label: 'September 2026', stunden: 3.75, anzahl: 3 },
      { monat: '2026-08', label: 'August 2026', stunden: 3, anzahl: 1 },
    ])
  })
  it('suggests last month, else the newest month', () => {
    const m = reportMonths(entries)
    expect(defaultReportMonth(m, new Date('2026-10-22T10:00:00Z'))).toBe('2026-09')
    expect(defaultReportMonth(m, new Date('2027-03-01T10:00:00Z'))).toBe('2026-09')
    expect(defaultReportMonth([], new Date())).toBeNull()
  })
  it('builds the month sorted by date with totals per project', () => {
    const r = buildTimeReport(entries, '2026-09')
    expect(r.eintraege.map(x => x.datum)).toEqual(['2026-09-01', '2026-09-03', '2026-09-15'])
    expect(r.total).toBe(3.75)
    expect(r.proProjekt).toEqual([{ projekt: 'Relaunch 2026', stunden: 2.25 }, { projekt: 'Shop', stunden: 1.5 }])
    expect(buildTimeReport(entries, '2026-08').proProjekt).toEqual([])
  })
  it('validates months and builds labels and file names', () => {
    expect(isMonth('2026-09')).toBe(true)
    expect(isMonth('2026-13')).toBe(false)
    expect(monthLabel('2026-03')).toBe('März 2026')
    expect(timeReportFileBase('2026-09', 'Muster AG')).toBe('Stundenrapport-2026-09-Muster-AG')
  })
})

describe('portal token', () => {
  it('creates unguessable URL-safe tokens of fixed length', () => {
    const a = newPortalToken()
    expect(isPortalToken(a)).toBe(true)
    expect(a).not.toBe(newPortalToken())
    expect(isPortalToken('../../etc')).toBe(false)
    expect(portalPath(a)).toBe(`/kunde/${a}`)
  })
})
