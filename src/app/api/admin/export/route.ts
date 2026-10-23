import { zipSync, strToU8, type Zippable } from 'fflate'
import { requireSession } from '@/lib/auth'
import { createServerSupabase } from '@/lib/supabase/server'
import { RECEIPT_BUCKET } from '@/lib/db/expenses'
import { renderInvoicePdf } from '@/lib/pdf/invoicePdf'
import { invoiceFileBase } from '@/lib/pdf/disposition'
import { MATERIAL_TABLES } from '@/modules/material'
import { backupTables, backupFileName, backupReadme, rowsToCsv, safeZipPath } from '@/lib/export/backup'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

type Row = Record<string, any>

/** Datensicherung als ZIP: Tabellen (JSON + CSV), Belege und Rechnungs-PDFs. */
export async function GET() {
  await requireSession()
  const supabase = await createServerSupabase()
  const now = new Date()
  const files: Zippable = {}
  const data: Record<string, Row[]> = {}
  const fehler: string[] = []

  // Tabellen seitenweise laden (PostgREST liefert höchstens 1000 Zeilen pro Abfrage)
  for (const table of backupTables()) {
    const rows: Row[] = []
    for (let from = 0; ; from += 1000) {
      const { data: page, error } = await supabase.from(table).select('*').range(from, from + 999)
      if (error) { fehler.push(`Tabelle ${table}: ${error.message}`); break }
      rows.push(...page)
      if (page.length < 1000) break
    }
    data[table] = rows
    files[`daten/${table}.json`] = strToU8(JSON.stringify(rows, null, 2))
    files[`daten/${table}.csv`] = strToU8(rowsToCsv(rows))
  }

  // Belege der Ausgaben und Material-Einträge (Originaldateien, schon komprimiert → ohne erneute Kompression)
  let belege = 0
  for (const e of [...(data.expenses ?? []), ...MATERIAL_TABLES.flatMap(t => data[t] ?? [])]) {
    if (!e.beleg_path) continue
    const { data: blob, error } = await supabase.storage.from(RECEIPT_BUCKET).download(e.beleg_path)
    if (error || !blob) { fehler.push(`Beleg ${e.beleg_path}`); continue }
    files[safeZipPath(`belege/${e.beleg_path}`)] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }]
    belege++
  }

  // Rechnungen als PDF (ohne Entwürfe), mit den heutigen Einstellungen neu erzeugt
  let pdfs = 0
  const settings = data.settings?.[0]
  const customers = new Map((data.customers ?? []).map(c => [c.id, c]))
  const itemsByInvoice = new Map<string, Row[]>()
  for (const it of data.invoice_items ?? []) itemsByInvoice.set(it.invoice_id, [...(itemsByInvoice.get(it.invoice_id) ?? []), it])
  if (settings) {
    for (const invoice of data.invoices ?? []) {
      if (invoice.status === 'entwurf') continue
      const customer = customers.get(invoice.customer_id)
      if (!customer) continue
      try {
        const items = (itemsByInvoice.get(invoice.id) ?? []).sort((a, b) => a.position - b.position)
        const pdf = await renderInvoicePdf({ invoice, items, customer, settings } as any)
        files[safeZipPath(`rechnungen/${invoiceFileBase(invoice.rechnungsnummer, customer.firma_oder_name)}.pdf`)] = [new Uint8Array(pdf), { level: 0 }]
        pdfs++
      } catch {
        fehler.push(`PDF ${invoice.rechnungsnummer}`)
      }
    }
  }

  const counts = Object.fromEntries(backupTables().map(t => [t, data[t]?.length ?? 0]))
  files['LIESMICH.txt'] = strToU8(backupReadme({ now, counts, belege, pdfs, fehler }))

  const zip = zipSync(files, { level: 6, mtime: now })
  return new Response(zip, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${backupFileName(now)}"`,
      'Cache-Control': 'no-store',
    },
  })
}
