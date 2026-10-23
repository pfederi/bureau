import { describe, it, expect } from 'vitest'
import { parseCustomerForm } from '@/lib/db/customers'

describe('parseCustomerForm', () => {
  it('requires a name and trims optional fields', () => {
    const fd = new FormData()
    fd.set('firma_oder_name', 'Muster AG')
    fd.set('adresse', 'Beispielstrasse 5')
    fd.set('plz', '3000'); fd.set('ort', 'Bern')
    fd.set('email', 'kontakt@muster-ag.ch')
    const parsed = parseCustomerForm(fd)
    expect(parsed.firma_oder_name).toBe('Muster AG')
    expect(parsed.land).toBe('Schweiz')
  })
  it('throws when name missing', () => {
    expect(() => parseCustomerForm(new FormData())).toThrow()
  })
  it('defaults land to Schweiz when submitted empty', () => {
    const fd = new FormData()
    fd.set('firma_oder_name', 'Test AG')
    fd.set('land', '')
    const parsed = parseCustomerForm(fd)
    expect(parsed.land).toBe('Schweiz')
  })
  it('stores hosting months as first of month and empty hosting fields as null', () => {
    const fd = new FormData()
    fd.set('firma_oder_name', 'Test AG')
    fd.set('hosting_text', 'Webhosting'); fd.set('hosting_preis_monat', '25')
    fd.set('hosting_ab', '2026-04'); fd.set('hosting_bis', '')
    const parsed = parseCustomerForm(fd)
    expect(parsed).toMatchObject({ hosting_text: 'Webhosting', hosting_preis_monat: 25, hosting_ab: '2026-04-01', hosting_bis: null })

    const empty = new FormData()
    empty.set('firma_oder_name', 'Test AG')
    empty.set('hosting_text', ''); empty.set('hosting_preis_monat', '')
    expect(parseCustomerForm(empty)).toMatchObject({ hosting_text: null, hosting_preis_monat: null, hosting_ab: null })
  })
  it('rejects a hosting end before its start', () => {
    const fd = new FormData()
    fd.set('firma_oder_name', 'Test AG')
    fd.set('hosting_ab', '2026-06'); fd.set('hosting_bis', '2026-03')
    expect(() => parseCustomerForm(fd)).toThrow()
  })
  it('stores an hour budget with its period, and no period without a budget', () => {
    const fd = new FormData()
    fd.set('firma_oder_name', 'Test AG')
    fd.set('stunden_budget', '20'); fd.set('budget_zeitraum', 'jahr')
    expect(parseCustomerForm(fd)).toMatchObject({ stunden_budget: 20, budget_zeitraum: 'jahr' })

    const ohne = new FormData()
    ohne.set('firma_oder_name', 'Test AG')
    ohne.set('stunden_budget', ''); ohne.set('budget_zeitraum', 'monat')
    expect(parseCustomerForm(ohne)).toMatchObject({ stunden_budget: null, budget_zeitraum: null })
  })
})
