import { listInvoices } from '@/lib/db/invoices'
import { listExpenses } from '@/lib/db/expenses'
import { computeYearReport, type YearReport } from '@/lib/expenses/report'

/** Abschluss für `jahr` plus Vorjahr (für den Vergleich). */
export async function loadYearReport(jahr: number): Promise<{ report: YearReport; vorjahr: YearReport }> {
  const [invoices, expenses] = await Promise.all([listInvoices(), listExpenses()])
  return { report: computeYearReport(invoices, expenses, jahr), vorjahr: computeYearReport(invoices, expenses, jahr - 1) }
}
