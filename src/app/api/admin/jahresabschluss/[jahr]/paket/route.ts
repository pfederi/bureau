import { type NextRequest, NextResponse } from 'next/server'
import { zipSync, strToU8, type Zippable } from 'fflate'
import { requireSession } from '@/lib/auth'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSettings } from '@/lib/db/settings'
import { listInvoices } from '@/lib/db/invoices'
import { listExpenses, RECEIPT_BUCKET } from '@/lib/db/expenses'
import { listCredits } from '@/modules/material'
import { computeYearReport, yearReportCsv } from '@/lib/expenses/report'
import { categoryLabel } from '@/lib/expenses/categories'
import { renderYearReportPdf } from '@/lib/pdf/yearReportPdf'
import { renderInvoicePdf } from '@/lib/pdf/invoicePdf'
import { invoiceFileBase } from '@/lib/pdf/disposition'
import { safeZipPath } from '@/lib/export/backup'
import { receiptFileName, taxPackageFileName, taxPackageReadme } from '@/lib/export/taxPackage'
import type { InvoiceItem } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** Steuerpaket als ZIP: Jahresabschluss, Belege, Rechnungen der Einnahmen und Material-Belege eines Jahres. */
export async function GET(_req: NextRequest, props: { params: Promise<{ jahr: string }> }) {
  const params = await props.params
  await requireSession()
  const jahr = Number(params.jahr)
  if (!Number.isInteger(jahr) || jahr < 2000 || jahr > 2100) return NextResponse.json({ error: 'Ungültiges Jahr.' }, { status: 400 })

  const supabase = await createServerSupabase()
  const [invoices, expenses, credits, settings] = await Promise.all([listInvoices(), listExpenses(), listCredits(), getSettings()])
  const report = computeYearReport(invoices, expenses, jahr)
  const vorjahr = computeYearReport(invoices, expenses, jahr - 1)
  const now = new Date()
  const files: Zippable = {}
  const fehler: string[] = []
  const lade = async (path: string) => {
    const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).download(path)
    return error || !data ? null : new Uint8Array(await data.arrayBuffer())
  }

  files[`Jahresabschluss-${jahr}.pdf`] = [new Uint8Array(await renderYearReportPdf(report, vorjahr, settings)), { level: 0 }]
  files[`Jahresabschluss-${jahr}.csv`] = strToU8(yearReportCsv(report, categoryLabel))

  // Belege der Ausgaben, sprechend benannt
  let belege = 0
  const namen = new Set<string>()
  const ohneBeleg = report.ausgaben.filter(e => !e.beleg_path).map(e => ({ datum: e.datum, beschreibung: e.beschreibung, betrag: Number(e.betrag) }))
  for (const e of report.ausgaben) {
    if (!e.beleg_path) continue
    const datei = await lade(e.beleg_path)
    if (!datei) { fehler.push(`Beleg ${e.datum} ${e.beschreibung}`); continue }
    files[safeZipPath(`belege/${receiptFileName({ ...e, beleg_path: e.beleg_path }, namen)}`)] = [datei, { level: 0 }]
    belege++
  }

  // Rechnungen, die im Jahr Einnahmen sind (bezahlt oder mit Material gedeckt)
  const nummern = new Set(report.einnahmen.map(e => e.rechnungsnummer))
  const bezahlt = invoices.filter(i => nummern.has(i.rechnungsnummer))
  const { data: items, error: itemsError } = bezahlt.length
    ? await supabase.from('invoice_items').select('*').in('invoice_id', bezahlt.map(i => i.id))
    : { data: [], error: null }
  if (itemsError) fehler.push(`Rechnungspositionen: ${itemsError.message}`)
  let rechnungen = 0
  for (const invoice of bezahlt) {
    try {
      const pos = ((items ?? []) as InvoiceItem[]).filter(it => it.invoice_id === invoice.id).sort((a, b) => a.position - b.position)
      const pdf = await renderInvoicePdf({ invoice, items: pos, customer: invoice.customer, settings })
      files[safeZipPath(`rechnungen/${invoiceFileBase(invoice.rechnungsnummer, invoice.customer.firma_oder_name)}.pdf`)] = [new Uint8Array(pdf), { level: 0 }]
      rechnungen++
    } catch {
      fehler.push(`Rechnung ${invoice.rechnungsnummer}`)
    }
  }

  // Belege zu Material, das im Jahr bezogen wurde (Gegenwert für Rechnungen mit Material-Verrechnung)
  let material = 0
  for (const c of credits) {
    if (c.typ !== 'material' || !c.beleg_path || !c.datum.startsWith(String(jahr))) continue
    const datei = await lade(c.beleg_path)
    if (!datei) { fehler.push(`Material-Beleg ${c.datum} ${c.beschreibung}`); continue }
    files[safeZipPath(`material/${receiptFileName({ ...c, lieferant: null, beleg_path: c.beleg_path }, namen)}`)] = [datei, { level: 0 }]
    material++
  }

  files['LIESMICH.txt'] = strToU8(taxPackageReadme({ report, now, belege, ohneBeleg, rechnungen, material, fehler }))

  const zip = zipSync(files, { level: 6, mtime: now })
  return new Response(zip, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${taxPackageFileName(jahr)}"`,
      'Cache-Control': 'no-store',
    },
  })
}
