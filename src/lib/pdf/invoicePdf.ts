import PDFDocument from 'pdfkit'
import { SwissQRBill } from 'swissqrbill/pdf'
import type { Invoice, InvoiceItem, Customer, Settings, Quote } from '@/lib/types'
import { computeInvoiceTotal, computeDiscountedTotals } from '@/lib/invoices/calc'
import { formatDatum } from '@/lib/utils'
import { formatChf } from '@/lib/invoices/stats'
import { addressLines, streetLine } from '@/lib/address'

type Data = { invoice: Invoice; items: InvoiceItem[]; customer: Customer; settings: Settings }

/** Gemeinsamer Aufbau für Rechnung und Offerte. */
type DocSpec = {
  titel: 'Rechnung' | 'Offerte'
  nummerLabel: string
  nummer: string
  datumLabel: string
  datum: string
  /** zweite Meta-Zeile rechts, z. B. Leistungsdatum oder Gültigkeit */
  zusatz: string
  betragLabel: string
  betrag: number
  rabattProzent: number
  mwstHinweis: string
  /** Freitext unter dem Betrag (nur Offerte) */
  text?: string | null
  stempel?: string
  bank: boolean
  qr: boolean
}

// Standardschrift Helvetica kennt U+202F nicht: Zifferngruppen mit geschütztem Leerschlag.
const pdfBetrag = { tabelle: true, abstand: '\u00A0' }
const fr = (n: number) => formatChf(n, pdfBetrag)

export async function renderInvoicePdf(data: Data): Promise<Buffer> {
  const { invoice } = data
  return renderDocument(data.items, data.customer, data.settings, {
    titel: 'Rechnung',
    nummerLabel: 'Rechnungsnummer',
    nummer: invoice.rechnungsnummer,
    datumLabel: 'Rechnungsdatum',
    datum: invoice.rechnungsdatum,
    zusatz: `Leistungsdatum: ${invoice.leistungsdatum ?? ''}`,
    betragLabel: 'Rechnungsbetrag',
    betrag: Number(invoice.betrag),
    rabattProzent: Number(invoice.rabatt_prozent ?? 0),
    mwstHinweis: invoice.mwst_hinweis,
    stempel: invoice.status === 'storniert' ? 'STORNIERT' : undefined,
    bank: true,
    qr: true,
  })
}

export async function renderQuotePdf(data: { quote: Quote; items: InvoiceItem[]; customer: Customer; settings: Settings }): Promise<Buffer> {
  const { quote } = data
  return renderDocument(data.items, data.customer, data.settings, {
    titel: 'Offerte',
    nummerLabel: 'Offertnummer',
    nummer: quote.offertnummer,
    datumLabel: 'Offertdatum',
    datum: quote.offertdatum,
    zusatz: quote.gueltig_bis ? `Gültig bis: ${formatDatum(quote.gueltig_bis)}` : '',
    betragLabel: 'Offertbetrag',
    betrag: Number(quote.betrag),
    rabattProzent: Number(quote.rabatt_prozent ?? 0),
    mwstHinweis: quote.mwst_hinweis,
    text: quote.notiz,
    bank: false,
    qr: false,
  })
}

async function renderDocument(items: InvoiceItem[], customer: Customer, settings: Settings, spec: DocSpec): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))))

  // Kopf: Absender-Kleinzeile
  doc.fontSize(8).fillColor('#444')
    .text(`${settings.absender_name} – ${settings.absender_adresse} – ${settings.absender_plz_ort}`, 50, 50)

  // Empfänger
  doc.fontSize(10).fillColor('#000').text(customer.firma_oder_name, 50, 90)
  for (const line of addressLines(customer.adresse)) doc.text(line)
  doc.text(`${customer.plz ?? ''} ${customer.ort ?? ''}`.trim()).text(customer.land)
  const empfaengerEnde = doc.y

  // Meta rechts
  const metaX = 330
  doc.fontSize(9)
    .text(`${spec.datumLabel}: ${formatDatum(spec.datum)}`, metaX, 90, { align: 'right' })
    .text(spec.zusatz, metaX, undefined, { align: 'right' })
    .text(`Ansprechperson: ${settings.absender_name}`, metaX, undefined, { align: 'right' })
    .text(`E-Mail: ${settings.absender_email}`, metaX, undefined, { align: 'right' })
    .text(`Telefon: ${settings.absender_tel}`, metaX, undefined, { align: 'right' })

  // Titel – rutscht nach unten, wenn die Adresse mehrzeilig ist
  const titelY = Math.max(190, empfaengerEnde + 20, doc.y + 20)
  doc.fontSize(18).fillColor('#000').text(spec.titel, 50, titelY)
  if (spec.stempel) {
    doc.fontSize(18).fillColor('#c00').text(spec.stempel, 330, titelY, { width: 215, align: 'right' })
    doc.fillColor('#000')
  }
  doc.fontSize(9)
    .text(`${spec.nummerLabel}: ${spec.nummer}    Kundennummer: ${customer.kundennummer}    Datum: ${formatDatum(spec.datum)}`, 50, titelY + 25)

  // Positionstabelle – Zeilenhöhe richtet sich nach der (umbrechenden) Bezeichnung,
  // bei Platzmangel neue Seite mit wiederholtem Tabellenkopf.
  const pageBottom = doc.page.height - 60
  const bezWidth = 200

  function tableHeader(top: number): number {
    doc.fontSize(9).fillColor('#000')
    doc.text('Pos.', 50, top).text('Bezeichnung', 90, top).text('Menge', 300, top)
      .text('Einheit', 350, top).text('Einzelpreis', 410, top).text('Gesamtpreis', 490, top)
    doc.moveTo(50, top + 15).lineTo(545, top + 15).stroke()
    return top + 23
  }

  // Sorgt dafür, dass ein Block der Höhe `needed` ab y auf die Seite passt.
  function ensureSpace(needed: number) {
    if (y + needed > pageBottom) {
      doc.addPage()
      y = 50
    }
  }

  let y = tableHeader(titelY + 60)
  for (const it of items) {
    doc.fontSize(9)
    const rowHeight = Math.max(doc.heightOfString(it.bezeichnung, { width: bezWidth }), doc.currentLineHeight())
    if (y + rowHeight > pageBottom) {
      doc.addPage()
      y = tableHeader(50)
    }
    doc.text(String(it.position), 50, y)
      .text(it.bezeichnung, 90, y, { width: bezWidth })
      .text(String(it.menge), 300, y)
      .text(it.einheit, 350, y)
      .text(fr(it.einzelpreis), 405, y, { width: 70, align: 'right', lineBreak: false })
      .text(fr(it.gesamtpreis), 475, y, { width: 70, align: 'right', lineBreak: false })
    y += rowHeight + 8
  }

  // Totals (als Block zusammenhalten)
  const rabattProzent = spec.rabattProzent
  ensureSpace(rabattProzent > 0 ? 70 : 35)
  doc.moveTo(50, y).lineTo(545, y).stroke()
  y += 10
  if (rabattProzent > 0) {
    const { zwischensumme, rabatt } = computeDiscountedTotals(computeInvoiceTotal(items), rabattProzent)
    doc.fontSize(9)
    doc.text('Zwischensumme', 50, y)
    doc.text(fr(zwischensumme), 350, y, { width: 195, align: 'right', lineBreak: false })
    y += 15
    doc.text(`Rabatt ${rabattProzent}%`, 50, y)
    doc.text(`– ${fr(rabatt)}`, 350, y, { width: 195, align: 'right', lineBreak: false })
    y += 18
  }
  doc.fontSize(11)
  doc.text(spec.betragLabel, 50, y)
  doc.text(fr(spec.betrag), 350, y, { width: 195, align: 'right', lineBreak: false })

  // Freitext der Offerte (z. B. Leistungsbeschrieb, Konditionen)
  if (spec.text?.trim()) {
    y += 30
    doc.fontSize(9)
    const h = doc.heightOfString(spec.text, { width: 495 })
    ensureSpace(Math.min(h, pageBottom - 50))
    doc.text(spec.text, 50, y, { width: 495 })
    y = doc.y
  }

  // Grussformel & Bank (als Block zusammenhalten)
  y += 40
  ensureSpace(spec.bank ? 115 : 60)
  doc.fontSize(9).text(customer.gruss || 'Freundliche Grüsse', 50, y)
  y += 30
  doc.text(settings.absender_name, 50, y)
  if (spec.bank) {
    y += 25
    doc.font('Helvetica-Bold').text('Bankverbindung:', 50, y)
    doc.font('Helvetica')
    y += 15
    doc.text(settings.bank_name, 50, y)
    y += 13
    doc.text(`IBAN: ${settings.iban}`, 50, y)
  }

  // MWST-Hinweis: unten auf der Seite, sonst direkt nach dem Inhalt
  y = Math.max(y + 30, 690)
  ensureSpace(15)
  doc.fontSize(8).fillColor('#333').text(spec.mwstHinweis, 50, y)

  // Fusszeile mit Seitenzahlen auf allen Rechnungsseiten (der QR-Zahlteil folgt
  // danach auf eigener Seite und bleibt ohne). Unterer Rand kurz auf 0, sonst
  // erzeugt pdfkit für Text unterhalb des Rands eine neue Seite.
  const pages = doc.bufferedPageRange()
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(pages.start + i)
    const bottomMargin = doc.page.margins.bottom
    doc.page.margins.bottom = 0
    const footerY = doc.page.height - 35
    doc.fontSize(8).fillColor('#666')
      .text(spec.nummer, 50, footerY, { lineBreak: false })
      .text(`Seite ${i + 1} von ${pages.count}`, 350, footerY, { width: 195, align: 'right', lineBreak: false })
    doc.page.margins.bottom = bottomMargin
  }
  doc.switchToPage(pages.start + pages.count - 1)

  if (!spec.qr) {
    doc.end()
    return done
  }

  // Schweizer QR-Zahlteil (neue Seite unten via SwissQRBill)
  const qr = new SwissQRBill({
    currency: 'CHF',
    amount: spec.betrag,
    creditor: {
      account: settings.iban.replace(/\s+/g, ''),
      name: settings.absender_name,
      address: settings.absender_adresse,
      zip: parseInt(settings.absender_plz_ort) || 0,
      city: settings.absender_plz_ort.replace(/^\d+\s*/, ''),
      country: 'CH',
    },
    debtor: {
      name: customer.firma_oder_name,
      address: streetLine(customer.adresse),
      zip: parseInt(customer.plz ?? '0') || 0,
      city: customer.ort ?? '',
      country: 'CH',
    },
  })
  qr.attachTo(doc)

  doc.end()
  return done
}
