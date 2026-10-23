import { edition } from '@/edition'
import { describe, it, expect } from 'vitest'
import { rowsToCsv, safeZipPath, backupFileName, backupReadme, backupTables, backupBeschreibung } from '@/lib/export/backup'
import { MATERIAL_TABLES } from '@/modules/material'

describe('backupTables', () => {
  it('sichert projects nur mit Website, customer_credits nur mit Material', () => {
    const t = backupTables()
    expect(t.includes('projects')).toBe(edition.website)
    expect(t.includes('customer_credits')).toBe(edition.material)
    expect(t.slice(0, 4)).toEqual(['customers', 'invoices', 'invoice_items', 'time_entries'])
  })
  it('richtet sich nach der übergebenen Edition', () => {
    const ohne = backupTables({ ...edition, website: false, material: false })
    expect(ohne).toEqual(['customers', 'invoices', 'invoice_items', 'time_entries', 'quotes', 'quote_items', 'expenses', 'settings'])
    const mit = backupTables({ ...edition, website: true, material: true })
    expect(mit.includes('projects')).toBe(true)
    // Material-Tabellen kommen aus dem Modul (in Bureau ein leerer Stub)
    expect(mit.filter(x => !ohne.includes(x) && x !== 'projects')).toEqual([...MATERIAL_TABLES])
  })
})

describe('rowsToCsv', () => {
  it('writes a semicolon CSV with BOM and all columns', () => {
    const csv = rowsToCsv([{ a: 1, b: 'x' }, { a: 2, c: null }])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.slice(1).split('\r\n')).toEqual(['a;b;c', '1;x;', '2;;', ''])
  })
  it('quotes separators, quotes and line breaks; objects as JSON', () => {
    const csv = rowsToCsv([{ t: 'A;B', q: 'sagt "Hallo"', n: 'Zeile 1\nZeile 2', o: { kind: 'web' } }])
    expect(csv).toContain('"A;B";"sagt ""Hallo""";"Zeile 1\nZeile 2";"{""kind"":""web""}"')
  })
})

describe('safeZipPath', () => {
  it('keeps normal paths and umlauts', () => {
    expect(safeZipPath('belege/2026/2026-10-16-musterhost.pdf')).toBe('belege/2026/2026-10-16-musterhost.pdf')
    expect(safeZipPath('rechnungen/RE-1_Muster Zeitung AG.pdf')).toBe('rechnungen/RE-1_Muster Zeitung AG.pdf')
  })
  it('neutralises traversal and odd characters', () => {
    expect(safeZipPath('belege/../../etc/passwd')).toBe('belege/_/_/etc/passwd')
    expect(safeZipPath('a/b:c*?.pdf')).toBe('a/b_c__.pdf')
  })
})

describe('backup texts', () => {
  it('names the file by date and lists contents', () => {
    const now = new Date('2026-10-21T18:00:00Z')
    expect(backupFileName(now)).toBe(`${edition.slug}-datensicherung-2026-10-21.zip`)
    const readme = backupReadme({ now, counts: { customers: 5 }, belege: 9, pdfs: 15, fehler: ['belege/x.pdf'] })
    expect(readme).toContain('- customers: 5')
    expect(readme).toContain('9 Belege')
    expect(readme).toContain('Nicht gesichert')
  })
})

describe('Material-Hinweise je Edition', () => {
  const mit = { ...edition, material: true }
  const ohne = { ...edition, material: false }
  it('Beschreibung in den Einstellungen', () => {
    expect(backupBeschreibung(mit)).toBe('Alle Daten als ZIP: Kunden, Rechnungen, Offerten, Zeiten, Ausgaben und Material als JSON und CSV, dazu alle Belege und die Rechnungen als PDF. Am besten einmal pro Jahr ablegen.')
    expect(backupBeschreibung(ohne)).toContain('Offerten, Zeiten und Ausgaben als JSON und CSV')
    expect(backupBeschreibung(ohne)).not.toMatch(/Material/)
  })
  it('LIESMICH der Sicherung', () => {
    const i = { now: new Date('2026-01-01T00:00:00Z'), counts: {}, belege: 1, pdfs: 1, fehler: [] }
    expect(backupReadme(i, { ...mit, adminTitel: 'Titel-A' })).toContain('Titel-A – Datensicherung')
    expect(backupReadme(i, mit)).toContain('Belege der Ausgaben und des Materials (Originaldateien)')
    expect(backupReadme(i, ohne)).toContain('Belege der Ausgaben (Originaldateien)')
    expect(backupReadme(i, ohne)).not.toMatch(/Material/)
  })
})
