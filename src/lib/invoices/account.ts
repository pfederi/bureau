import type { CreditType, CustomerCredit, Invoice } from '@/lib/types'

/**
 * Kundenkonto für Rechnungen, die mit Material (oder Zahlungen) verrechnet
 * werden: Gutschriften decken die Rechnungen der Reihe nach ab, älteste zuerst.
 * Gerechnet wird in Rappen, damit keine Rundungsfehler entstehen.
 */

export type AccountInvoice = Pick<
  Invoice,
  'id' | 'customer_id' | 'rechnungsnummer' | 'rechnungsdatum' | 'betrag' | 'status' | 'paid_at' | 'verrechnung_material'
>
export type AccountCredit = Pick<
  CustomerCredit,
  'id' | 'customer_id' | 'datum' | 'typ' | 'beschreibung' | 'betrag' | 'created_at'
>

export type InvoiceCoverage = {
  invoice: AccountInvoice
  gedeckt: number
  rest: number
  /** Datum, an dem die Rechnung voll gedeckt wurde (nie vor dem Rechnungsdatum), sonst null */
  gedecktAm: string | null
}

export type AccountSummary = {
  rechnungen: InvoiceCoverage[]
  totalRechnungen: number
  totalGutschriften: number
  /** > 0: Kunde schuldet noch; < 0: Guthaben des Kunden */
  saldo: number
}

export type AccountEntry = {
  key: string
  datum: string
  art: 'rechnung' | CreditType
  text: string
  /** Rechnung positiv, Gutschrift negativ */
  betrag: number
  saldo: number
  coverage?: InvoiceCoverage
  credit?: AccountCredit
}

export type StatusUpdate = { id: string; status: 'versendet' | 'bezahlt'; paid_at: string | null }

const cents = (n: number) => Math.round(Number(n) * 100)
const chf = (c: number) => c / 100

export function isAccountInvoice(i: AccountInvoice): boolean {
  return i.verrechnung_material && (i.status === 'versendet' || i.status === 'bezahlt')
}

function byInvoiceOrder(a: AccountInvoice, b: AccountInvoice) {
  return a.rechnungsdatum.localeCompare(b.rechnungsdatum) || a.rechnungsnummer.localeCompare(b.rechnungsnummer)
}

function byCreditOrder(a: AccountCredit, b: AccountCredit) {
  return a.datum.localeCompare(b.datum) || a.created_at.localeCompare(b.created_at)
}

/** Anteil einer Gutschrift an einer Rechnung; `teil`: die Gutschrift ist auf mehrere Rechnungen verteilt. */
export type CreditPart<C extends AccountCredit = AccountCredit> = { credit: C; betrag: number; teil: boolean }

export type AccountGroup<C extends AccountCredit = AccountCredit> = { coverage: InvoiceCoverage; parts: CreditPart<C>[] }

export type AccountGroups<C extends AccountCredit = AccountCredit> = {
  /** Konto-Rechnungen, älteste zuerst, je mit den Gutschriften, die sie decken */
  gruppen: AccountGroup<C>[]
  /** Noch keiner Rechnung zugeordnet (Guthaben) */
  uebrig: CreditPart<C>[]
}

/**
 * Ordnet die Gutschriften den Konto-Rechnungen zu, älteste zuerst. Eine Gutschrift
 * kann auf zwei Rechnungen verteilt sein. Andere Rechnungen werden ignoriert.
 */
export function groupAccount<C extends AccountCredit>(invoices: AccountInvoice[], credits: C[]): AccountGroups<C> {
  const rechnungen = invoices.filter(isAccountInvoice).sort(byInvoiceOrder)
  const gutschriften = [...credits].sort(byCreditOrder)
  const part = (credit: C, c: number): CreditPart<C> => ({ credit, betrag: chf(c), teil: c !== cents(credit.betrag) })

  let ci = 0
  let left = gutschriften.length ? cents(gutschriften[0].betrag) : 0

  const gruppen = rechnungen.map(invoice => {
    const total = cents(invoice.betrag)
    const parts: CreditPart<C>[] = []
    let need = total
    let am: string | null = total === 0 ? invoice.rechnungsdatum : null
    while (need > 0 && ci < gutschriften.length) {
      const take = Math.min(need, left)
      if (take > 0) parts.push(part(gutschriften[ci], take))
      need -= take
      left -= take
      if (need === 0) am = gutschriften[ci].datum
      if (left === 0) {
        ci++
        left = ci < gutschriften.length ? cents(gutschriften[ci].betrag) : 0
      }
    }
    const coverage: InvoiceCoverage = {
      invoice,
      gedeckt: chf(total - need),
      rest: chf(need),
      gedecktAm: am && (am < invoice.rechnungsdatum ? invoice.rechnungsdatum : am),
    }
    return { coverage, parts }
  })

  const uebrig: CreditPart<C>[] = []
  for (; ci < gutschriften.length; ci++) {
    if (left > 0) uebrig.push(part(gutschriften[ci], left))
    left = ci + 1 < gutschriften.length ? cents(gutschriften[ci + 1].betrag) : 0
  }
  return { gruppen, uebrig }
}

/** Deckung pro Konto-Rechnung eines Kunden. Andere Rechnungen werden ignoriert. */
export function allocateCredits(invoices: AccountInvoice[], credits: AccountCredit[]): InvoiceCoverage[] {
  return groupAccount(invoices, credits).gruppen.map(g => g.coverage)
}

export function computeAccount(invoices: AccountInvoice[], credits: AccountCredit[]): AccountSummary {
  const rechnungen = allocateCredits(invoices, credits)
  const r = rechnungen.reduce((s, c) => s + cents(c.invoice.betrag), 0)
  const g = credits.reduce((s, c) => s + cents(c.betrag), 0)
  return { rechnungen, totalRechnungen: chf(r), totalGutschriften: chf(g), saldo: chf(r - g) }
}

/** Chronologische Kontoauszug-Zeilen mit laufendem Saldo (am selben Tag Rechnungen zuerst). */
export function accountTimeline(invoices: AccountInvoice[], credits: AccountCredit[]): AccountEntry[] {
  const entries: Omit<AccountEntry, 'saldo'>[] = [
    ...allocateCredits(invoices, credits).map(c => ({
      key: `i-${c.invoice.id}`,
      datum: c.invoice.rechnungsdatum,
      art: 'rechnung' as const,
      text: `Rechnung ${c.invoice.rechnungsnummer}`,
      betrag: Number(c.invoice.betrag),
      coverage: c,
    })),
    ...[...credits].sort(byCreditOrder).map(c => ({
      key: `c-${c.id}`,
      datum: c.datum,
      art: c.typ,
      text: c.beschreibung,
      betrag: -Number(c.betrag),
      credit: c,
    })),
  ]
  // Array.prototype.sort ist stabil: innerhalb gleicher Art bleibt die Reihenfolge von oben.
  entries.sort((a, b) =>
    a.datum.localeCompare(b.datum) || Number(a.art !== 'rechnung') - Number(b.art !== 'rechnung'))

  let saldo = 0
  return entries.map(e => {
    saldo += cents(e.betrag)
    return { ...e, saldo: chf(saldo) }
  })
}

/** Welche Konto-Rechnungen ihren Status (oder ihr Bezahlt-Datum) ändern müssen. */
export function accountStatusUpdates(coverage: InvoiceCoverage[]): StatusUpdate[] {
  const updates: StatusUpdate[] = []
  for (const c of coverage) {
    const { id, status, paid_at } = c.invoice
    if (c.rest === 0) {
      if (status !== 'bezahlt' || paid_at?.slice(0, 10) !== c.gedecktAm) {
        updates.push({ id, status: 'bezahlt', paid_at: c.gedecktAm })
      }
    } else if (status === 'bezahlt') {
      updates.push({ id, status: 'versendet', paid_at: null })
    }
  }
  return updates
}

/** Gedeckter Betrag je Konto-Rechnung über alle Kunden (für die Dashboard-Kachel „Offen"). */
export function coveredAmounts(invoices: AccountInvoice[], credits: AccountCredit[]): Map<string, number> {
  const result = new Map<string, number>()
  const customerIds = new Set(invoices.filter(isAccountInvoice).map(i => i.customer_id))
  for (const id of Array.from(customerIds)) {
    const coverage = allocateCredits(
      invoices.filter(i => i.customer_id === id),
      credits.filter(c => c.customer_id === id),
    )
    for (const c of coverage) result.set(c.invoice.id, c.gedeckt)
  }
  return result
}

export type PaymentInvoice = Pick<Invoice, 'id' | 'rechnungsnummer' | 'rechnungsdatum' | 'betrag' | 'status' | 'paid_at'>

export type CustomerOwed = {
  /** Offener Saldo im Materialkonto (nie negativ) */
  konto: number
  /** Guthaben des Kunden im Materialkonto (mehr Material als verrechnet), sonst 0 */
  guthaben: number
  /** Versendete, noch nicht bezahlte normale Rechnungen */
  offeneRechnungen: number
  offeneAnzahl: number
  total: number
}

/**
 * Was der Kunde insgesamt schuldet: offener Konto-Saldo plus offene normale
 * Rechnungen. Material-Guthaben wird nicht mit normalen Rechnungen verrechnet,
 * die werden mit Geld bezahlt.
 */
export function computeCustomerOwed(kontoSaldo: number, paymentInvoices: PaymentInvoice[]): CustomerOwed {
  const offen = paymentInvoices.filter(i => i.status === 'versendet')
  const konto = Math.max(cents(kontoSaldo), 0)
  const offeneRechnungen = offen.reduce((s, i) => s + cents(i.betrag), 0)
  return {
    konto: chf(konto),
    guthaben: chf(Math.max(-cents(kontoSaldo), 0)),
    offeneRechnungen: chf(offeneRechnungen),
    offeneAnzahl: offen.length,
    total: chf(konto + offeneRechnungen),
  }
}
