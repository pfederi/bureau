import { edition } from '@/edition'
import { describe, it, expect } from 'vitest'
import { buildWeeklyEmail, weeklyFrom } from '@/lib/email/weekly'
import { estimateReserve } from '@/lib/expenses/reserve'

const base = {
  baseUrl: 'https://admin.example.ch', datum: '26.10.2026', jahr: 2026,
  todos: [], offen: [], unbilled: [], gewinn: 898.95, ruecklage: estimateReserve(898.95, 2026, 25),
}

describe('buildWeeklyEmail', () => {
  it('says all done without todos', () => {
    const m = buildWeeklyEmail(base)
    expect(m.subject).toBe(`${edition.name} · Wochenübersicht 26.10.2026: alles erledigt`)
    expect(m.html).toContain(`${edition.name} · Admin`)
    expect(m.text.startsWith(`${edition.name} · Admin`)).toBe(true)
    expect(m.text).toContain('Rücklage ca.')
  })
  it('counts todos and urgent ones, links absolute and escapes names', () => {
    const m = buildWeeklyEmail({
      ...base,
      todos: [
        { key: 'a', art: 'erinnern', titel: 'RE-1 · A&B <AG>', detail: '45 Tage offen', href: '/admin/rechnungen', dringend: true, tage: 15, betrag: 500 },
        { key: 'b', art: 'beleg', titel: 'Beleg fehlt: Domain', detail: 'jährlich', href: '/admin/ausgaben', dringend: false, tage: 3 },
      ],
      offen: [{ id: 'i', rechnungsnummer: 'RE-1', kunde: 'A&B <AG>', rest: 500, tage: 45, ueberfaellig: true }],
    })
    expect(m.subject).toBe(`${edition.name} · Wochenübersicht 26.10.2026: 2 Todos, 1 dringend`)
    expect(m.html).toContain('href="https://admin.example.ch/admin/rechnungen"')
    expect(m.html).toContain('A&amp;B &lt;AG&gt;')
    expect(m.html).not.toContain('<AG>')
  })
})

describe('weeklyFrom', () => {
  it('uses the edition name as sender name with the invoice address', () => {
    expect(weeklyFrom('Anna Muster <anna@example.ch>')).toBe(`${edition.name} <anna@example.ch>`)
    expect(weeklyFrom('anna@example.ch')).toBe(`${edition.name} <anna@example.ch>`)
  })
})
