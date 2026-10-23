/**
 * Datensicherung: alle Tabellen als JSON (vollständig, zum Wiederherstellen) und als
 * CSV (für Excel), dazu Belege und Rechnungs-PDFs. Reine Hilfsfunktionen, das Laden
 * passiert in der Route.
 */

import { csvCell } from './csv'
import { edition, type Edition } from '@/edition'
import { MATERIAL_TABLES } from '@/modules/material'

/** Tabellen in der Sicherung, in dieser Reihenfolge (Edition als Parameter für Tests) */
export function backupTables(ed: Edition = edition): readonly string[] {
  return [
    'customers', 'invoices', 'invoice_items', 'time_entries', ...(ed.material ? MATERIAL_TABLES : []),
    'quotes', 'quote_items', 'expenses', 'settings', ...(ed.website ? ['projects'] : []),
  ]
}


/** CSV für Excel: Semikolon, UTF-8 mit BOM, Spalten aus allen Zeilen (Reihenfolge der ersten Vorkommen). */
export function rowsToCsv(rows: Record<string, unknown>[]): string {
  const cols: string[] = []
  for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k)
  const lines = [cols.join(';'), ...rows.map(r => cols.map(c => csvCell(r[c])).join(';'))]
  return '﻿' + lines.join('\r\n') + '\r\n'
}

/** Dateiname im ZIP ohne Pfad-Tricks: nur sichere Zeichen, keine «..»-Segmente. */
export function safeZipPath(path: string): string {
  return path
    .split('/')
    .map(seg => seg.normalize('NFC').replace(/[^\p{L}\p{N}._ -]/gu, '_').replace(/^\.+$/, '_'))
    .filter(Boolean)
    .join('/')
}

export function backupFileName(now: Date): string {
  return `${edition.slug}-datensicherung-${now.toISOString().slice(0, 10)}.zip`
}

/** Beschreibung der Datensicherung in den Einstellungen (ohne Material in Bureau) */
export function backupBeschreibung(ed: Edition = edition): string {
  const liste = ed.material
    ? 'Kunden, Rechnungen, Offerten, Zeiten, Ausgaben und Material'
    : 'Kunden, Rechnungen, Offerten, Zeiten und Ausgaben'
  return `Alle Daten als ZIP: ${liste} als JSON und CSV, dazu alle Belege und die Rechnungen als PDF. Am besten einmal pro Jahr ablegen.`
}

export function backupReadme(input: { now: Date; counts: Record<string, number>; belege: number; pdfs: number; fehler: string[] }, ed: Edition = edition): string {
  const lines = [
    `${ed.adminTitel} – Datensicherung`,
    `Erstellt: ${input.now.toISOString()}`,
    '',
    'Inhalt',
    '- daten/*.json  Alle Tabellen vollständig (zum Wiederherstellen)',
    '- daten/*.csv   Dieselben Tabellen für Excel (Semikolon, UTF-8)',
    `- belege/       ${input.belege} Belege der Ausgaben ${ed.material ? 'und des Materials ' : ''}(Originaldateien)`,
    `- rechnungen/   ${input.pdfs} Rechnungen als PDF, neu erzeugt mit den heutigen Einstellungen`,
    '',
    'Hinweis: Die PDFs unter rechnungen/ sind Neuausgaben. Massgebend für die Aufbewahrung',
    '(10 Jahre) sind die tatsächlich versendeten Rechnungen.',
    '',
    'Datensätze',
    ...Object.entries(input.counts).map(([t, n]) => `- ${t}: ${n}`),
  ]
  if (input.fehler.length) lines.push('', 'Nicht gesichert', ...input.fehler.map(f => `- ${f}`))
  return lines.join('\r\n') + '\r\n'
}
