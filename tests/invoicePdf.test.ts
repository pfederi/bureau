import { describe, it, expect } from 'vitest'
import { renderInvoicePdf, renderQuotePdf } from '@/lib/pdf/invoicePdf'
import type { Invoice, InvoiceItem, Customer, Settings } from '@/lib/types'

const settings: Settings = {
  id: 1, absender_name: 'Anna Muster', absender_adresse: 'Musterweg 1',
  absender_plz_ort: '8000 Zürich', absender_land: 'Schweiz', absender_tel: '+41 79 000 00 00',
  absender_email: 'anna@example.ch', bank_name: 'Musterbank',
  iban: 'CH93 0076 2011 6238 5295 7', standard_stundensatz: 120,
  mwst_hinweis: 'Von der MWST gemäss Art. 10 Abs. 2 befreit.', naechste_nummer: 8,
}
const customer: Customer = {
  id: 'c', kundennummer: 42, firma_oder_name: 'Muster AG', adresse: 'Beispielstrasse 5',
  plz: '3000', ort: 'Bern', land: 'Schweiz', email: 'x@example.ch', ansprechperson: null, gruss: 'Freundliche Grüsse',
  hosting_text: null, hosting_preis_monat: null, hosting_ab: null, hosting_bis: null, stunden_budget: null, budget_zeitraum: null,
}
const invoice: Invoice = {
  id: 'i', rechnungsnummer: 'RE-2025-JAN-15-0007', customer_id: 'c', typ: 'pauschal',
  status: 'entwurf', rechnungsdatum: '2025-01-15', leistungsdatum: '2024', betrag: 63.16, rabatt_prozent: 0, hosting_jahr: null, verrechnung_material: false,
  waehrung: 'CHF', notiz: null, mwst_hinweis: settings.mwst_hinweis, sent_at: null, paid_at: null, erinnert_am: null, storniert_am: null, offerte_id: null,
}
const items: InvoiceItem[] = [
  { position: 1, bezeichnung: 'Provision 2024', menge: 1, einheit: 'Stück', einzelpreis: 63.16, gesamtpreis: 63.16 },
]

describe('renderInvoicePdf', () => {
  it('produces a non-empty PDF buffer', async () => {
    const buf = await renderInvoicePdf({ invoice, items, customer, settings })
    expect(buf.length).toBeGreaterThan(1000)
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('renders an invoice with discount', async () => {
    const buf = await renderInvoicePdf({ invoice: { ...invoice, rabatt_prozent: 10, betrag: 56.84 }, items, customer, settings })
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
  })
})

describe('renderQuotePdf', () => {
  // Seitenzahl aus dem PDF lesen: Rechnung = Inhalt + QR-Seite, Offerte ohne QR-Zahlteil.
  const pageCount = (buf: Buffer) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length

  it('renders a quote without the QR payment page', async () => {
    const quote = {
      id: 'q', offertnummer: 'OF-2026-OCT-21-42-0001', customer_id: 'c', status: 'entwurf' as const,
      offertdatum: '2026-10-21', gueltig_bis: '2026-11-30', betrag: 63.16, rabatt_prozent: 0,
      notiz: 'Umsetzung innert vier Wochen nach Auftrag.', mwst_hinweis: settings.mwst_hinweis, sent_at: null, invoice_id: null,
    }
    const offerte = await renderQuotePdf({ quote, items, customer, settings })
    const rechnung = await renderInvoicePdf({ invoice, items, customer, settings })
    expect(offerte.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pageCount(offerte)).toBe(pageCount(rechnung) - 1)
  })
})
