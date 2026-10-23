import PDFDocument from 'pdfkit'
import type { Settings } from '@/lib/types'
import type { YearReport } from '@/lib/expenses/report'
import { categoryLabel } from '@/lib/expenses/categories'
import { formatChf, formatWaehrung } from '@/lib/invoices/stats'
import { formatDatum } from '@/lib/utils'

// Helvetica kennt U+202F nicht: Zifferngruppen mit geschütztem Leerschlag.
const fr = (n: number) => formatChf(n, { tabelle: true, abstand: ' ' })

/** Jahresabschluss als PDF zum Beilegen zur Steuererklärung (Hilfsblatt A). */
export async function renderYearReportPdf(report: YearReport, vorjahr: YearReport, settings: Settings): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))))
  const bottom = doc.page.height - 60
  let y = 50

  const ensure = (h: number) => { if (y + h > bottom) { doc.addPage(); y = 50 } }
  const row = (cols: { text: string; x: number; w: number; align?: 'left' | 'right' }[], bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
    const h = Math.max(...cols.map(c => doc.heightOfString(c.text, { width: c.w })))
    ensure(h + 4)
    for (const c of cols) doc.text(c.text, c.x, y, { width: c.w, align: c.align ?? 'left' })
    y += h + 4
  }
  const rule = () => { doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).strokeColor('#999').stroke(); y += 6 }
  const heading = (text: string) => {
    ensure(40)
    y += 10
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000').text(text, 50, y)
    y = doc.y + 6
  }

  // Kopf
  doc.font('Helvetica').fontSize(9).fillColor('#444')
    .text(`${settings.absender_name} · ${settings.absender_adresse} · ${settings.absender_plz_ort}`, 50, y)
  y += 30
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#000').text(`Jahresabschluss ${report.jahr}`, 50, y)
  y = doc.y + 4
  doc.font('Helvetica').fontSize(9).fillColor('#444')
    .text('Selbständige Erwerbstätigkeit im Nebenerwerb · Einnahmen nach Zahlungseingang', 50, y)
  y = doc.y + 4
  doc.fillColor('#000')

  // Zusammenfassung
  heading('Zusammenfassung')
  const sumRow = (label: string, betrag: number, vj: number | null, bold = false) =>
    row([
      { text: label, x: 50, w: 300 },
      { text: fr(betrag), x: 350, w: 95, align: 'right' },
      { text: vj === null ? '' : fr(vj), x: 450, w: 95, align: 'right' },
    ], bold)
  row([{ text: '', x: 50, w: 300 }, { text: String(report.jahr), x: 350, w: 95, align: 'right' }, { text: String(vorjahr.jahr), x: 450, w: 95, align: 'right' }], true)
  rule()
  sumRow('Einnahmen', report.einnahmenTotal, vorjahr.einnahmenTotal)
  for (const k of report.proKategorie) {
    const vj = vorjahr.proKategorie.find(v => v.kategorie === k.kategorie)?.betrag ?? 0
    sumRow(`Ausgaben: ${k.label}`, -k.betrag, -vj)
  }
  sumRow('Total Ausgaben', -report.ausgabenTotal, -vorjahr.ausgabenTotal)
  rule()
  sumRow('Gewinn', report.gewinn, vorjahr.gewinn, true)

  // Einnahmen
  heading('Einnahmen')
  if (report.einnahmen.length === 0) row([{ text: 'Keine Einnahmen in diesem Jahr.', x: 50, w: 495 }])
  else {
    row([{ text: 'Bezahlt', x: 50, w: 60 }, { text: 'Rechnung', x: 110, w: 150 }, { text: 'Kunde', x: 260, w: 140 }, { text: 'Art', x: 400, w: 50 }, { text: 'Betrag', x: 450, w: 95, align: 'right' }], true)
    rule()
    for (const e of report.einnahmen) {
      row([{ text: formatDatum(e.datum), x: 50, w: 60 }, { text: e.rechnungsnummer, x: 110, w: 150 }, { text: e.kunde, x: 260, w: 140 }, { text: e.art, x: 400, w: 50 }, { text: fr(e.betrag), x: 450, w: 95, align: 'right' }])
    }
  }

  // Ausgaben
  heading('Ausgaben')
  if (report.ausgaben.length === 0) row([{ text: 'Keine Ausgaben erfasst.', x: 50, w: 495 }])
  else {
    row([{ text: 'Datum', x: 50, w: 60 }, { text: 'Beschreibung', x: 110, w: 170 }, { text: 'Kategorie', x: 280, w: 120 }, { text: 'Beleg', x: 400, w: 50 }, { text: 'Betrag', x: 450, w: 95, align: 'right' }], true)
    rule()
    for (const e of report.ausgaben) {
      row([
        { text: formatDatum(e.datum), x: 50, w: 60 },
        { text: [e.lieferant ? `${e.beschreibung} (${e.lieferant})` : e.beschreibung, e.waehrung !== 'CHF' && e.betrag_original !== null ? formatWaehrung(Number(e.betrag_original), e.waehrung, { abstand: '\u00A0' }) : ''].filter(Boolean).join(' · '), x: 110, w: 170 },
        { text: categoryLabel(e.kategorie), x: 280, w: 120 },
        { text: e.beleg_path ? 'ja' : '–', x: 400, w: 50 },
        { text: fr(Number(e.betrag)), x: 450, w: 95, align: 'right' },
      ])
    }
  }

  // Offene Rechnungen am Jahresende (zählen erst bei Zahlung)
  if (report.offenAmJahresende.length > 0) {
    heading(`Offen am 31.12.${report.jahr}`)
    doc.font('Helvetica').fontSize(8).fillColor('#444')
    ensure(14)
    doc.text('Verrechnet, aber erst später bezahlt. Diese Beträge zählen im Jahr des Zahlungseingangs.', 50, y, { width: 495 })
    y = doc.y + 4
    doc.fillColor('#000')
    for (const o of report.offenAmJahresende) {
      row([{ text: formatDatum(o.rechnungsdatum), x: 50, w: 60 }, { text: o.rechnungsnummer, x: 110, w: 150 }, { text: o.kunde, x: 260, w: 190 }, { text: fr(o.betrag), x: 450, w: 95, align: 'right' }])
    }
  }

  // Fusszeile mit Seitenzahlen
  const pages = doc.bufferedPageRange()
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(pages.start + i)
    const margin = doc.page.margins.bottom
    doc.page.margins.bottom = 0
    doc.font('Helvetica').fontSize(8).fillColor('#666')
      .text(`Jahresabschluss ${report.jahr} · ${settings.absender_name}`, 50, doc.page.height - 35, { lineBreak: false })
      .text(`Seite ${i + 1} von ${pages.count}`, 350, doc.page.height - 35, { width: 195, align: 'right', lineBreak: false })
    doc.page.margins.bottom = margin
  }
  doc.end()
  return done
}
