import { describe, it, expect } from 'vitest'
import { angezeigterSatz, ansaetzeAus, betroffeneOffene, projektAnsatz, projektSchluessel, vorgeschlagenerAnsatz } from '@/lib/timeEntries/rates'

const projekte = [
  { customer_id: 'k1', projekt: 'Relaunch 2026', stundensatz: 140 },
  { customer_id: 'k2', projekt: 'Wartung', stundensatz: 100 },
]
const a = ansaetzeAus(120, [{ id: 'k1', stundensatz: 130 }, { id: 'k2', stundensatz: null }], projekte)

describe('projektSchluessel', () => {
  it('vergleicht ohne Gross-/Kleinschreibung und Leerzeichen am Rand', () => {
    expect(projektSchluessel('  Relaunch 2026 ')).toBe('relaunch 2026')
    expect(projektSchluessel('   ')).toBeNull()
    expect(projektSchluessel(null)).toBeNull()
  })
})

describe('vorgeschlagenerAnsatz', () => {
  it('Projekt vor Kunde vor Standard', () => {
    expect(vorgeschlagenerAnsatz(a, 'k1', 'relaunch 2026 ')).toEqual({ ansatz: 140, quelle: 'projekt' })
    expect(vorgeschlagenerAnsatz(a, 'k1', 'Wartung')).toEqual({ ansatz: 130, quelle: 'kunde' })
    expect(vorgeschlagenerAnsatz(a, 'k1')).toEqual({ ansatz: 130, quelle: 'kunde' })
    expect(vorgeschlagenerAnsatz(a, 'k2', 'Wartung')).toEqual({ ansatz: 100, quelle: 'projekt' })
    expect(vorgeschlagenerAnsatz(a, 'k2')).toEqual({ ansatz: 120, quelle: 'standard' })
    expect(vorgeschlagenerAnsatz(a, 'unbekannt')).toEqual({ ansatz: 120, quelle: 'standard' })
  })
  it('Projekt-Ansatz gilt nur beim eigenen Kunden', () => {
    expect(projektAnsatz(projekte, 'k1', 'Wartung')).toBeNull()
  })
})

describe('betroffeneOffene', () => {
  const e = (p: Record<string, unknown>) => ({ customer_id: 'k1', billed: false, stundensatz: 130, projekt: null, ...p }) as any
  const eintraege = [
    e({ id: 1 }),                                   // Kunde, alter Satz → betroffen
    e({ id: 2, projekt: 'Wartung' }),               // Projekt ohne eigenen Ansatz → betroffen
    e({ id: 3, projekt: 'Relaunch 2026' }),         // Projekt mit eigenem Ansatz → nicht
    e({ id: 4, stundensatz: 90 }),                  // von Hand abweichend → nicht
    e({ id: 5, billed: true }),                     // verrechnet → nie
    e({ id: 6, customer_id: 'k2' }),                // anderer Kunde → nicht
    e({ id: 7, stundensatz: '130.00' }),            // Zahl als Text aus der DB → betroffen
  ]
  it('Kunden-Ansatz: offene Einträge des Kunden mit altem Satz, ohne Projekte mit eigenem Ansatz', () => {
    const ids = betroffeneOffene(eintraege, { customerId: 'k1', projekt: null, alterAnsatz: 130, projekte }).map(x => x.id)
    expect(ids).toEqual([1, 2, 7])
  })
  it('Projekt-Ansatz: nur Einträge dieses Projekts', () => {
    const liste = [...eintraege, e({ id: 8, projekt: ' relaunch 2026', stundensatz: 140 })]
    const ids = betroffeneOffene(liste, { customerId: 'k1', projekt: 'Relaunch 2026', alterAnsatz: 140, projekte }).map(x => x.id)
    expect(ids).toEqual([8])
  })
})

describe('angezeigterSatz', () => {
  it('folgt dem Vorschlag sofort, solange der Satz nicht von Hand geändert wurde (auch beim Speichern per Enter)', () => {
    expect(angezeigterSatz({ satz: 130, vonHand: false, vorschlag: 140 })).toBe(140)
  })
  it('behält einen von Hand gesetzten oder kopierten Satz', () => {
    expect(angezeigterSatz({ satz: 95, vonHand: true, vorschlag: 140 })).toBe(95)
  })
})
