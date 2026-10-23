import { listInvoices } from '@/lib/db/invoices'
import { listCustomers } from '@/lib/db/customers'
import { listCredits } from '@/modules/material'
import { listTimeEntries } from '@/lib/db/timeEntries'
import { listQuotes } from '@/lib/db/quotes'
import { listExpenses } from '@/lib/db/expenses'
import { listSites } from '@/lib/db/sites'
import { computeYearReport } from '@/lib/expenses/report'
import { findMissingRecurring } from '@/lib/expenses/recurring'
import { computeTodos } from '@/lib/dashboard/todos'
import TodoCard from './TodoCard'
import YearComparison from './YearComparison'
import CustomerDonut from './CustomerDonut'
import { getSettings } from '@/lib/db/settings'
import { estimateReserve } from '@/lib/expenses/reserve'
import { coveredAmounts } from '@/lib/invoices/account'
import {
  computeDashboardStats, computeMonthlyRevenue, computeMonthlyHours, computeYearHours, computeVatStatus,
  openInvoiceRows, unbilledHoursByCustomer, revenueByCustomer, formatChf, formatBetrag, formatStunden,
  type OpenInvoiceRow, type UnbilledRow, type VatStatus,
} from '@/lib/invoices/stats'
import { StatCard, ChfValue, PaymentsChart, HoursChart, BudgetBar, customerColors } from './DashboardWidgets'
import StickyHeader from './StickyHeader'
import { budgetUsage, type BudgetUsage } from '@/lib/invoices/budget'
import { cn, FIRST_BUSINESS_YEAR } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'

export const metadata = { title: 'Dashboard' }

// Pflicht beginnt nach Ablauf des Jahres, in dem die Grenze erreicht wird;
// Anmeldung innert 30 Tagen, sobald das Überschreiten absehbar ist.
function vatText(vat: VatStatus): string {
  if (vat.stufe === 'pflichtig') return `Grenze erreicht – MWST-pflichtig ab ${vat.jahr + 1}, bei der ESTV anmelden`
  if (vat.stufe === 'nahe') return 'Nahe an der MWST-Grenze – Anmeldung innert 30 Tagen, sobald Überschreiten absehbar'
  return 'Nicht MWST-pflichtig'
}

function VatCard({ vat, className }: { vat: VatStatus; className?: string }) {
  return (
    <Card className={className}>
      <CardContent className="pt-4 sm:pt-6">
        <div className="text-sm text-muted-foreground">MWST-Status {vat.jahr}</div>
        <div
          className={cn(
            'mt-2 text-base font-medium',
            vat.stufe === 'nahe' && 'text-amber-400',
            vat.stufe === 'pflichtig' && 'text-destructive',
          )}
        >
          {vatText(vat)}
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(vat.anteil * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Anteil an der MWST-Umsatzgrenze">
          <div
            className={cn(
              'h-full origin-left rounded-full bg-primary motion-safe:animate-wachsen-x',
              vat.stufe === 'nahe' && 'bg-amber-500',
              vat.stufe === 'pflichtig' && 'bg-destructive',
            )}
            style={{ width: `${Math.max(vat.anteil * 100, vat.umsatz > 0 ? 1 : 0)}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between gap-2 text-xs text-muted-foreground tabular-nums">
          <span>Umsatz {formatChf(vat.umsatz)}</span>
          <span>{Math.round(vat.anteil * 100)} % von {formatChf(vat.schwelle)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

const SICHTBAR = 4

function OpenCard({ betrag, rows, className }: { betrag: number; rows: OpenInvoiceRow[]; className?: string }) {
  return (
    <Card className={className}>
      <CardContent className="flex h-full flex-col pt-4 sm:pt-6">
        <div className="text-sm text-muted-foreground">Offen</div>
        <div className="mt-2 text-2xl font-medium tracking-tight tabular-nums sm:text-3xl"><ChfValue amount={betrag} /></div>
        <div className="mt-1.5 text-xs text-muted-foreground">{rows.length} versendet, noch nicht bezahlt</div>
        {rows.length > 0 && (
          <ul className="mt-4 space-y-2 border-t pt-3 text-sm">
            {rows.slice(0, SICHTBAR).map(r => (
              <li key={r.id} className="flex items-baseline gap-3" title={r.rechnungsnummer}>
                <span className="min-w-0 flex-1 truncate">{r.kunde}</span>
                <span className="tabular-nums">{formatBetrag(r.rest, { tabelle: true })}</span>
                <span className={cn('w-16 shrink-0 text-right text-xs tabular-nums', r.ueberfaellig ? 'font-medium text-amber-400' : 'text-muted-foreground')}>
                  {r.tage} {r.tage === 1 ? 'Tag' : 'Tage'}
                </span>
              </li>
            ))}
          </ul>
        )}
        <a href="/admin/rechnungen?status=versendet&jahr=alle" className="mt-auto pt-3 text-xs text-muted-foreground hover:text-foreground hover:underline">
          {rows.length > SICHTBAR ? `Alle ${rows.length} offenen Rechnungen →` : 'Offene Rechnungen anzeigen →'}
        </a>
      </CardContent>
    </Card>
  )
}

type CustomerBudget = { customerId: string; kunde: string; usage: BudgetUsage }

function HoursCard({ jahr, total, rows, budgets, colors, className }: {
  jahr: number; total: number; rows: UnbilledRow[]; budgets: CustomerBudget[]; colors: Record<string, string>; className?: string
}) {
  const offenStunden = rows.reduce((s, r) => s + r.stunden, 0)
  const offenWert = rows.reduce((s, r) => s + r.wert, 0)
  return (
    <Card className={className}>
      <CardContent className="flex h-full flex-col pt-4 sm:pt-6">
        <div className="text-sm text-muted-foreground">Stunden {jahr}</div>
        <div className="mt-2 text-3xl font-medium tracking-tight tabular-nums">
          {formatStunden(total)}<span className="ml-1.5 text-base font-medium text-muted-foreground">Std.</span>
        </div>
        <div className="mt-4 border-t pt-3">
          <div className="mb-2 text-xs text-muted-foreground">Noch nicht verrechnet</div>
          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Alles verrechnet.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {rows.map(r => (
                <li key={r.customerId}>
                  <a href={`/admin/zeiterfassung?kunde=${r.customerId}`} className="flex items-baseline gap-2 hover:text-blue-300">
                    <span className={cn('h-2 w-2 shrink-0 self-center rounded-full', colors[r.customerId] ?? 'bg-slate-400')} />
                    <span className="min-w-0 flex-1 truncate">{r.kunde}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{formatStunden(r.stunden)} Std.</span>
                    <span className="w-20 shrink-0 text-right tabular-nums">{formatBetrag(r.wert, { tabelle: true })}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        {budgets.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <div className="mb-2 text-xs text-muted-foreground">Stundenbudgets</div>
            <ul className="space-y-3 text-sm">
              {budgets.map(b => (
                <li key={b.customerId}>
                  <a href={`/admin/kunden/${b.customerId}/konto`} className="mb-1 flex items-baseline gap-2 hover:text-blue-300">
                    <span className={cn('h-2 w-2 shrink-0 self-center rounded-full', colors[b.customerId] ?? 'bg-slate-400')} />
                    <span className="min-w-0 flex-1 truncate">{b.kunde}</span>
                    <span className="text-xs text-muted-foreground">{b.usage.label}</span>
                  </a>
                  <BudgetBar usage={b.usage} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {rows.length > 1 && (
          <div className="mt-auto flex items-baseline gap-2 border-t pt-3 text-sm font-medium">
            <span className="flex-1">Total offen</span>
            <span className="text-xs text-muted-foreground tabular-nums">{formatStunden(offenStunden)} Std.</span>
            <span className="w-20 shrink-0 text-right tabular-nums">{formatBetrag(offenWert, { tabelle: true })}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default async function Dashboard() {
  const [invoices, customers, credits, timeEntries, quotes, expenses, settings, sites] = await Promise.all([
    listInvoices(), listCustomers(), listCredits(), listTimeEntries({ status: 'alle' }), listQuotes(), listExpenses(),
    getSettings().catch(() => null), listSites().catch(() => []),
  ])
  const jahr = new Date().getFullYear()
  const covered = coveredAmounts(invoices, credits)
  const stats = computeDashboardStats(invoices, customers.length, jahr, covered)
  const monthlyRevenue = computeMonthlyRevenue(invoices, 12, new Date())
  const vat = computeVatStatus(invoices, jahr)
  const monthlyHours = computeMonthlyHours(timeEntries, 12, new Date())
  const yearHours = computeYearHours(timeEntries, jahr)
  const colors = customerColors(customers.map(c => c.id))
  const openRows = openInvoiceRows(invoices, covered, new Date())
  const unbilled = unbilledHoursByCustomer(timeEntries)
  const todos = computeTodos({ invoices, quotes, timeEntries, customers, sites, fehlendeBelege: findMissingRecurring(expenses, new Date(), settings?.belege_ausgeblendet ?? []), now: new Date() })
  const jahre = Array.from({ length: jahr - FIRST_BUSINESS_YEAR + 1 }, (_, i) => FIRST_BUSINESS_YEAR + i)
  const jahresvergleich = jahre.map(j => {
    const r = computeYearReport(invoices, expenses, j)
    return { jahr: j, einnahmen: r.einnahmenTotal, ausgaben: r.ausgabenTotal, gewinn: r.gewinn }
  })
  const gewinnJahr = jahresvergleich[jahresvergleich.length - 1]?.gewinn ?? 0
  const ausgabenJahr = jahresvergleich[jahresvergleich.length - 1]?.ausgaben ?? 0
  const belegeJahr = expenses.filter(e => e.datum.startsWith(`${jahr}-`)).length
  const ruecklage = estimateReserve(gewinnJahr, jahr, Number(settings?.grenzsteuersatz ?? 25))
  const budgets = customers.flatMap(c => {
    const usage = budgetUsage(c, timeEntries, new Date())
    return usage ? [{ customerId: c.id, kunde: c.firma_oder_name, usage }] : []
  })
  return (
    <div className="space-y-6">
      <StickyHeader>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Überblick über Kunden, Stunden und Rechnungen.</p>
        </div>
      </StickyHeader>
      <TodoCard todos={todos} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Gesamtverdienst" value={<ChfValue amount={stats.gesamtverdienst} />} hint="Alle bezahlten Rechnungen" />
        <StatCard label={`Verdienst ${jahr}`} value={<ChfValue amount={stats.verdienstJahr} />} hint="Bezahlt, nach Rechnungsdatum" />
        <a href={`/admin/ausgaben/abschluss?jahr=${jahr}`} className="rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring *:h-full">
          <StatCard
            label={`Rücklage ${jahr}`}
            value={<ChfValue amount={ruecklage.total} />}
            hint={`AHV und Steuern auf ${formatChf(gewinnJahr)} Gewinn, geschätzt`}
            className="transition-colors hover:border-blue-300/60"
          />
        </a>
        <a href={`/admin/ausgaben?jahr=${jahr}`} className="rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring *:h-full">
          <StatCard
            label={`Ausgaben ${jahr}`}
            value={<ChfValue amount={ausgabenJahr} />}
            hint={belegeJahr === 1 ? '1 Beleg erfasst' : `${belegeJahr} Belege erfasst`}
            className="transition-colors hover:border-blue-300/60"
          />
        </a>
      </div>
      {/* Rechte Spalte: „Offen“ wächst mit (flex-1), damit die Spalte bündig mit dem Diagramm endet. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <PaymentsChart data={monthlyRevenue} colors={colors} className="lg:col-span-2" />
        <div className="flex flex-col gap-4">
          <OpenCard betrag={stats.offenBetrag} rows={openRows} className="flex-1" />
          <VatCard vat={vat} />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <HoursChart data={monthlyHours} colors={colors} className="lg:col-span-2" />
        <HoursCard jahr={jahr} total={yearHours.total} rows={unbilled} budgets={budgets} colors={colors} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3 *:min-w-0">
        <YearComparison rows={jahresvergleich} className="lg:col-span-2" />
        <CustomerDonut shares={revenueByCustomer(invoices)} colors={colors} />
      </div>
    </div>
  )
}
