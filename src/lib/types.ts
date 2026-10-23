export type Settings = {
  id: number
  absender_name: string
  absender_adresse: string
  absender_plz_ort: string
  absender_land: string
  absender_tel: string
  absender_email: string
  bank_name: string
  iban: string
  standard_stundensatz: number
  mwst_hinweis: string
  naechste_nummer: number
  /** Für die Schätzung der Steuer-Rücklage, in Prozent */
  grenzsteuersatz?: number
  /** Ausgeblendete Hinweise auf fehlende Belege (`hideId` aus expenses/recurring) */
  belege_ausgeblendet?: string[]
}

export type Customer = {
  id: string
  kundennummer: number
  firma_oder_name: string
  adresse: string | null
  plz: string | null
  ort: string | null
  land: string
  email: string | null
  ansprechperson: string | null
  gruss: string
  hosting_text: string | null
  hosting_preis_monat: number | null
  /** Erster Tag des Startmonats, YYYY-MM-DD */
  hosting_ab: string | null
  /** Erster Tag des letzten Monats, YYYY-MM-DD */
  hosting_bis: string | null
  /** Stundenbudget pro Zeitraum (null = kein Budget) */
  stunden_budget: number | null
  budget_zeitraum: 'monat' | 'jahr' | null
  /** Kundenlink (private Seite unter /kunde/…), null = keiner */
  portal_token?: string | null
  portal_erstellt_am?: string | null
}

export type InvoiceItem = {
  id?: string
  invoice_id?: string
  position: number
  bezeichnung: string
  menge: number
  einheit: string
  einzelpreis: number
  gesamtpreis: number
}

export type InvoiceType = 'pauschal' | 'stunden'
export type InvoiceStatus = 'entwurf' | 'versendet' | 'bezahlt' | 'storniert'

export type Invoice = {
  id: string
  rechnungsnummer: string
  customer_id: string
  typ: InvoiceType
  status: InvoiceStatus
  rechnungsdatum: string
  leistungsdatum: string | null
  betrag: number
  rabatt_prozent: number
  hosting_jahr: number | null
  /** Wird über das Kundenkonto mit Material/Zahlungen verrechnet statt einzeln bezahlt. */
  verrechnung_material: boolean
  waehrung: string
  notiz: string | null
  mwst_hinweis: string
  sent_at: string | null
  paid_at: string | null
  /** Letzte Zahlungserinnerung */
  erinnert_am: string | null
  storniert_am: string | null
  /** Offerte, aus der die Rechnung erstellt wurde */
  offerte_id: string | null
}

export type TimeEntry = {
  id: string
  customer_id: string
  datum: string
  beschreibung: string
  stunden: number
  stundensatz: number
  billed: boolean
  invoice_id: string | null
  /** Projekt für die Auswertung, z. B. «Relaunch 2026» */
  projekt?: string | null
}

export type CreditType = 'material' | 'zahlung'

/** Gutschrift im Kundenkonto: bezogenes Material (Gegenwert) oder Geldzahlung. */
export type CustomerCredit = {
  id: string
  customer_id: string
  datum: string
  typ: CreditType
  beschreibung: string
  betrag: number
  created_at: string
  /** Beleg im privaten Bucket (Ordner material/), z. B. Rechnung des Lieferanten */
  beleg_path?: string | null
  beleg_name?: string | null
}

export type QuoteStatus = 'entwurf' | 'versendet' | 'angenommen' | 'abgelehnt'

export type Quote = {
  id: string
  offertnummer: string
  customer_id: string
  status: QuoteStatus
  offertdatum: string
  gueltig_bis: string | null
  betrag: number
  rabatt_prozent: number
  notiz: string | null
  mwst_hinweis: string
  sent_at: string | null
  /** Daraus erstellte Rechnung */
  invoice_id: string | null
}

export type ExpenseCategory =
  | 'material' | 'fremdleistungen' | 'software' | 'hosting' | 'hardware'
  | 'buero' | 'reise' | 'werbung' | 'weiterbildung' | 'uebriges'

export type Currency = 'CHF' | 'EUR' | 'USD'

export type Expense = {
  id: string
  datum: string
  beschreibung: string
  lieferant: string | null
  kategorie: ExpenseCategory
  /** Franken-Betrag (zählt im Abschluss) */
  betrag: number
  waehrung: Currency
  /** Betrag in der Originalwährung, nur bei EUR/USD */
  betrag_original: number | null
  beleg_path: string | null
  beleg_name: string | null
}
