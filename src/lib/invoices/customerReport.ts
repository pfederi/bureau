import type { Invoice, TimeEntry } from '@/lib/types'
import { zuBezahlen } from '@/lib/invoices/guthaben'

type Rechnung = Pick<Invoice, 'id' | 'customer_id' | 'status' | 'betrag' | 'rabatt_prozent' | 'rechnungsdatum' | 'sent_at' | 'paid_at' | 'verrechnung_material' | 'guthaben_angerechnet'>
  & { customer?: { firma_oder_name: string } | null }
type Eintrag = Pick<TimeEntry, 'invoice_id' | 'stunden' | 'stundensatz'>

export type KundenZeile = {
  customerId: string
  kunde: string
  umsatz: number
  /** Anteil am Umsatz aller Kunden in %, ganze Zahl */
  anteil: number
  offen: number
  stunden: number
  /** Verrechneter Stundenbetrag nach Rabatt pro Stunde, null ohne Stunden */
  ansatzEffektiv: number | null
  /** Ø Tage von Versand (sonst Rechnungsdatum) bis Zahlung, null ohne bezahlte Rechnung */
  zahlungTage: number | null
  zahlungAnzahl: number
}
export type KundenAuswertung = { zeilen: KundenZeile[]; total: Omit<KundenZeile, 'customerId' | 'kunde'> }
export type SortSpalte = 'umsatz' | 'anteil' | 'offen' | 'stunden' | 'ansatz' | 'zahlung' | 'kunde'
export type Sortierung = { spalte: SortSpalte; richtung: 'ab' | 'auf' }
export const SORT_SPALTEN: readonly SortSpalte[] = ['umsatz', 'anteil', 'offen', 'stunden', 'ansatz', 'zahlung', 'kunde']

const TAG = 86_400_000
const round2 = (n: number) => Math.round(n * 100) / 100

type Summe = { umsatz: number; offen: number; stunden: number; wert: number; tage: number; anzahl: number }
const leer = (): Summe => ({ umsatz: 0, offen: 0, stunden: 0, wert: 0, tage: 0, anzahl: 0 })

/** Kalendertag in Zürcher Zeit; reine Daten (YYYY-MM-DD) bleiben, wie sie sind. */
function kalenderTag(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' })
}

/** Ganze Kalendertage von Versand (sonst Rechnungsdatum) bis Zahlung, nie negativ. */
function zahlungsTage(r: Rechnung): number {
  const von = Date.parse(`${kalenderTag(r.sent_at ?? r.rechnungsdatum)}T00:00:00Z`)
  const bis = Date.parse(`${kalenderTag(r.paid_at as string)}T00:00:00Z`)
  return Math.max(0, Math.round((bis - von) / TAG))
}

function zeile(s: Summe, totalUmsatz: number): Omit<KundenZeile, 'customerId' | 'kunde'> {
  return {
    umsatz: round2(s.umsatz),
    anteil: totalUmsatz > 0 ? Math.round((s.umsatz / totalUmsatz) * 100) : 0,
    offen: round2(s.offen),
    stunden: round2(s.stunden),
    ansatzEffektiv: s.stunden > 0 ? round2(s.wert / s.stunden) : null,
    zahlungTage: s.anzahl > 0 ? Math.round(s.tage / s.anzahl) : null,
    zahlungAnzahl: s.anzahl,
  }
}

/** Umsatz (versendet + bezahlt nach Rechnungsdatum), offen, Stunden, effektiver Ansatz und Zahlungsdauer pro Kunde; jahr = null: alle Jahre. */
export function kundenAuswertung(invoices: Rechnung[], entries: Eintrag[], jahr: number | null, gedeckt: Map<string, number> = new Map()): KundenAuswertung {
  const relevant = invoices.filter(i =>
    (i.status === 'versendet' || i.status === 'bezahlt') && (jahr === null || i.rechnungsdatum.startsWith(String(jahr))))
  const byId = new Map(relevant.map(i => [i.id, i]))
  const proKunde = new Map<string, Summe & { kunde: string }>()
  const total = leer()
  const summe = (i: Rechnung) => {
    let s = proKunde.get(i.customer_id)
    if (!s) { s = { ...leer(), kunde: i.customer?.firma_oder_name ?? 'Unbekannt' }; proKunde.set(i.customer_id, s) }
    return s
  }
  for (const i of relevant) {
    const s = summe(i)
    const betrag = Number(i.betrag)
    const offen = i.status === 'versendet' ? Math.max(0, zuBezahlen(i) - (gedeckt.get(i.id) ?? 0)) : 0
    // Material-Verrechnung und ganz mit Guthaben Beglichenes sind keine echten Zahlungen des Kunden
    const zaehlt = i.status === 'bezahlt' && i.paid_at && !i.verrechnung_material && zuBezahlen(i) > 0
    for (const x of [s, total]) {
      x.umsatz += betrag
      x.offen += offen
      if (zaehlt) { x.tage += zahlungsTage(i); x.anzahl += 1 }
    }
  }
  for (const e of entries) {
    const i = e.invoice_id ? byId.get(e.invoice_id) : undefined
    if (!i) continue
    const stunden = Number(e.stunden)
    const wert = stunden * Number(e.stundensatz) * (1 - Number(i.rabatt_prozent ?? 0) / 100)
    for (const x of [summe(i), total]) { x.stunden += stunden; x.wert += wert }
  }
  const zeilen = Array.from(proKunde.entries())
    .map(([customerId, s]) => ({ customerId, kunde: s.kunde, ...zeile(s, total.umsatz) }))
    .sort((a, b) => b.umsatz - a.umsatz)
  return { zeilen, total: { ...zeile(total, total.umsatz), anteil: total.umsatz > 0 ? 100 : 0 } }
}

function wert(z: KundenZeile, spalte: Exclude<SortSpalte, 'kunde'>): number | null {
  switch (spalte) {
    case 'umsatz': case 'anteil': return z.umsatz
    case 'offen': return z.offen
    case 'stunden': return z.stunden > 0 ? z.stunden : null
    case 'ansatz': return z.ansatzEffektiv
    case 'zahlung': return z.zahlungTage
  }
}

/** Sortiert nach einer Spalte; Zeilen ohne Wert stehen immer unten. */
export function sortiereZeilen(zeilen: KundenZeile[], s: Sortierung): KundenZeile[] {
  const faktor = s.richtung === 'auf' ? 1 : -1
  return [...zeilen].sort((a, b) => {
    if (s.spalte === 'kunde') return faktor * a.kunde.localeCompare(b.kunde, 'de')
    const va = wert(a, s.spalte)
    const vb = wert(b, s.spalte)
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1
    return faktor * (va - vb)
  })
}

/** Kunde mit mehr als der Hälfte des Umsatzes, sonst null. */
export function dominanterKunde(a: KundenAuswertung): KundenZeile | null {
  if (a.total.umsatz <= 0) return null
  return a.zeilen.find(z => z.umsatz / a.total.umsatz > 0.5) ?? null
}
