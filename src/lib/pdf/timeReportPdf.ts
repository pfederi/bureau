import PDFDocument from 'pdfkit'
import type { Customer, Settings } from '@/lib/types'
import type { TimeReport } from '@/lib/timeEntries/report'
import type { BudgetUsage } from '@/lib/invoices/budget'
import { formatStunden } from '@/lib/invoices/stats'
import { formatDatum } from '@/lib/utils'
import { addressLines } from '@/lib/address'

const std = (n: number) => `${formatStunden(n)} Std.`

/** Stundenrapport eines Monats für den Kunden: Einträge mit Stunden, ohne Beträge. */
export async function renderTimeReportPdf(input: {
  report: TimeReport; customer: Customer; settings: Settings; budget: BudgetUsage | null; datum: string
}): Promise<Buffer> {
  const { report, customer, settings, budget } = input
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))))
  const bottom = doc.page.height - 60

  // Kopf wie auf der Rechnung
  doc.font('Helvetica').fontSize(8).fillColor('#444')
    .text(`${settings.absender_name} – ${settings.absender_adresse} – ${settings.absender_plz_ort}`, 50, 50)
  doc.fontSize(10).fillColor('#000').text(customer.firma_oder_name, 50, 90)
  for (const line of addressLines(customer.adresse)) doc.text(line)
  doc.text(`${customer.plz ?? ''} ${customer.ort ?? ''}`.trim()).text(customer.land)
  const empfaengerEnde = doc.y
  doc.fontSize(9)
    .text(`Datum: ${formatDatum(input.datum)}`, 330, 90, { align: 'right' })
    .text(`Ansprechperson: ${settings.absender_name}`, 330, undefined, { align: 'right' })
    .text(`E-Mail: ${settings.absender_email}`, 330, undefined, { align: 'right' })

  const titelY = Math.max(190, empfaengerEnde + 20, doc.y + 20)
  doc.font('Helvetica-Bold').fontSize(18).text(`Stundenrapport ${report.label}`, 50, titelY)
  let y = doc.y + 16

  const ensure = (h: number) => { if (y + h > bottom) { doc.addPage(); y = 50; return true } return false }
  const header = () => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000')
      .text('Datum', 50, y).text('Tätigkeit', 115, y).text('Stunden', 465, y, { width: 80, align: 'right' })
    y += 14
    doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).strokeColor('#999').stroke()
    y += 6
  }
  header()
  for (const e of report.eintraege) {
    const text = e.projekt && !e.beschreibung.startsWith(e.projekt) ? `${e.projekt}: ${e.beschreibung}` : e.beschreibung
    doc.font('Helvetica').fontSize(9)
    const h = Math.max(doc.heightOfString(text, { width: 340 }), doc.currentLineHeight())
    if (ensure(h + 6)) header()
    doc.font('Helvetica').fontSize(9).fillColor('#000')
      .text(formatDatum(e.datum), 50, y)
      .text(text, 115, y, { width: 340 })
      .text(formatStunden(Number(e.stunden)), 465, y, { width: 80, align: 'right' })
    y += h + 6
  }
  ensure(30)
  doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).strokeColor('#999').stroke()
  y += 6
  doc.font('Helvetica-Bold').fontSize(10).text('Total', 50, y).text(std(report.total), 395, y, { width: 150, align: 'right' })
  y += 22

  if (report.proProjekt.length > 1) {
    ensure(20 + report.proProjekt.length * 14)
    doc.font('Helvetica-Bold').fontSize(9).text('Nach Projekt', 50, y)
    y += 14
    for (const p of report.proProjekt) {
      doc.font('Helvetica').fontSize(9).text(p.projekt, 50, y, { width: 340 }).text(std(p.stunden), 395, y, { width: 150, align: 'right' })
      y += 14
    }
    y += 8
  }

  // Stundenbudget, falls es denselben Zeitraum betrifft
  if (budget) {
    ensure(30)
    doc.font('Helvetica').fontSize(9).fillColor('#444')
      .text(`Stundenbudget ${budget.label}: ${std(budget.verbraucht)} von ${std(budget.budget)} verbraucht`
        + (budget.verbraucht > budget.budget ? ` (${std(budget.verbraucht - budget.budget)} darüber)` : ''), 50, y, { width: 495 })
    doc.fillColor('#000')
  }

  const pages = doc.bufferedPageRange()
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(pages.start + i)
    const margin = doc.page.margins.bottom
    doc.page.margins.bottom = 0
    doc.font('Helvetica').fontSize(8).fillColor('#666')
      .text(`Stundenrapport ${report.label} · ${customer.firma_oder_name}`, 50, doc.page.height - 35, { lineBreak: false })
      .text(`Seite ${i + 1} von ${pages.count}`, 350, doc.page.height - 35, { width: 195, align: 'right', lineBreak: false })
    doc.page.margins.bottom = margin
  }
  doc.end()
  return done
}
