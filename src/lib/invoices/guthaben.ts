import type { CustomerGuthaben, Invoice } from '@/lib/types'

/**
 * Kundenguthaben (z. B. Überzahlungen) und ihre Anrechnung an Rechnungen. Der
 * Rechnungsbetrag bleibt der Umsatz; zu bezahlen ist nur der Rest. Stornierte
 * Rechnungen geben ihr angerechnetes Guthaben wieder frei. Gerechnet wird in Rappen.
 */

export type GuthabenEintrag = Pick<CustomerGuthaben, 'id' | 'datum' | 'betrag' | 'beschreibung' | 'created_at'>
export type GuthabenRechnung = Pick<Invoice, 'id' | 'status' | 'rechnungsnummer' | 'rechnungsdatum' | 'guthaben_angerechnet'>

const cents = (n: number) => Math.round(Number(n) * 100)
const chf = (c: number) => c / 100

export const angerechnet = (i: Pick<Invoice, 'guthaben_angerechnet'>) => Number(i.guthaben_angerechnet ?? 0)

/** Was der Kunde für die Rechnung noch überweisen muss. */
export function zuBezahlen(i: Pick<Invoice, 'betrag' | 'guthaben_angerechnet'>): number {
  return chf(Math.max(0, cents(i.betrag) - cents(angerechnet(i))))
}

/** Rechnungen, die Guthaben verbrauchen (alle ausser stornierten, auch Entwürfe – sonst würde es doppelt verplant). */
function verbrauchend(invoices: GuthabenRechnung[], ohne?: string) {
  return invoices.filter(i => i.status !== 'storniert' && i.id !== ohne && angerechnet(i) > 0)
}

/** Verfügbares Guthaben; `ohne`: diese Rechnung nicht mitzählen (beim Neuberechnen ihrer Anrechnung). */
export function guthabenSaldo(eintraege: Pick<GuthabenEintrag, 'betrag'>[], invoices: GuthabenRechnung[], ohne?: string): number {
  const haben = eintraege.reduce((s, e) => s + cents(e.betrag), 0)
  const verbraucht = verbrauchend(invoices, ohne).reduce((s, i) => s + cents(angerechnet(i)), 0)
  return chf(haben - verbraucht)
}

/** Wie viel an einer Rechnung angerechnet wird: höchstens das Verfügbare und höchstens der Rechnungsbetrag. */
export function anrechnungFuer(verfuegbar: number, betrag: number): number {
  return chf(Math.max(0, Math.min(cents(verfuegbar), cents(betrag))))
}

function byEintrag(a: GuthabenEintrag, b: GuthabenEintrag) {
  return a.datum.localeCompare(b.datum) || a.created_at.localeCompare(b.created_at)
}

/**
 * Herkunft einer neuen Anrechnung: Guthaben wird der Reihe nach verbraucht (ältestes zuerst).
 * `verbraucht` ist, was andere Rechnungen schon angerechnet haben.
 */
export function guthabenQuellen(eintraege: GuthabenEintrag[], verbraucht: number, betrag: number): string[] {
  let skip = cents(verbraucht)
  let rest = cents(betrag)
  const quellen: string[] = []
  for (const e of [...eintraege].sort(byEintrag)) {
    if (rest <= 0) break
    const frei = cents(e.betrag) - Math.min(skip, cents(e.betrag))
    skip = Math.max(0, skip - cents(e.betrag))
    if (frei <= 0) continue
    rest -= frei
    if (!quellen.includes(e.beschreibung)) quellen.push(e.beschreibung)
  }
  return quellen
}

/** Anrechnung für eine Rechnung samt Herkunftstext (null = nichts anzurechnen). */
export function planAnrechnung(
  eintraege: GuthabenEintrag[],
  invoices: GuthabenRechnung[],
  invoice: Pick<Invoice, 'id' | 'betrag'>,
): { betrag: number; text: string | null } {
  const verfuegbar = guthabenSaldo(eintraege, invoices, invoice.id)
  const betrag = anrechnungFuer(verfuegbar, Number(invoice.betrag))
  if (betrag <= 0) return { betrag: 0, text: null }
  const verbraucht = verbrauchend(invoices, invoice.id).reduce((s, i) => s + angerechnet(i), 0)
  return { betrag, text: guthabenQuellen(eintraege, verbraucht, betrag).join(', ') || null }
}

export type GuthabenZeile = {
  key: string
  datum: string
  text: string
  /** Gutschrift positiv, Anrechnung negativ */
  betrag: number
  saldo: number
  eintrag?: GuthabenEintrag
  rechnung?: GuthabenRechnung
}

/** Verlauf für das Kundenkonto: Guthaben und Anrechnungen chronologisch mit laufendem Saldo. */
export function guthabenVerlauf(eintraege: GuthabenEintrag[], invoices: GuthabenRechnung[]): GuthabenZeile[] {
  const zeilen: Omit<GuthabenZeile, 'saldo'>[] = [
    ...eintraege.map(e => ({ key: `g-${e.id}`, datum: e.datum, text: e.beschreibung, betrag: Number(e.betrag), eintrag: e })),
    ...verbrauchend(invoices).map(i => ({
      key: `r-${i.id}`, datum: i.rechnungsdatum, text: `Angerechnet an ${i.rechnungsnummer}`, betrag: -angerechnet(i), rechnung: i,
    })),
  ]
  // Am selben Tag zuerst das Guthaben, dann die Anrechnung
  zeilen.sort((a, b) => a.datum.localeCompare(b.datum) || Number(a.betrag < 0) - Number(b.betrag < 0))
  let saldo = 0
  return zeilen.map(z => {
    saldo += cents(z.betrag)
    return { ...z, saldo: chf(saldo) }
  })
}
