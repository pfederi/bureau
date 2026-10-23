const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

function formatNumber(prefix: 'RE' | 'OF', date: Date, kundennummer: number, counter: number): string {
  const y = date.getUTCFullYear()
  const mon = MONTHS[date.getUTCMonth()]
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const num = String(counter).padStart(4, '0')
  return `${prefix}-${y}-${mon}-${dd}-${kundennummer}-${num}`
}

export function formatInvoiceNumber(date: Date, kundennummer: number, counter: number): string {
  return formatNumber('RE', date, kundennummer, counter)
}

/** Offertnummer mit eigenem Zähler pro Kunde: OF-{YYYY}-{MON}-{DD}-{Kundennummer}-{####} */
export function formatQuoteNumber(date: Date, kundennummer: number, counter: number): string {
  return formatNumber('OF', date, kundennummer, counter)
}
