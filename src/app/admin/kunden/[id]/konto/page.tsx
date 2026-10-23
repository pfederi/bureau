import { notFound } from 'next/navigation'
import { ArrowLeft, FilePlus2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCustomer } from '@/lib/db/customers'
import { listInvoices } from '@/lib/db/invoices'
import { listCredits, MaterialSection } from '@/modules/material'
import { computeAccount, computeCustomerOwed, coveredAmounts } from '@/lib/invoices/account'
import { computeDashboardStats, formatChf, formatBetrag } from '@/lib/invoices/stats'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatDatum } from '@/lib/utils'
import { StatCard, ChfValue, BudgetBar } from '../../../DashboardWidgets'
import { listTimeEntries } from '@/lib/db/timeEntries'
import { budgetUsage } from '@/lib/invoices/budget'
import CustomerHeaderActions from './CustomerHeaderActions'
import ProjectsCard from './ProjectsCard'
import { projectStats } from '@/lib/timeEntries/projectStats'
import { InvoicePreviewButton } from '../../../InvoicePreview'
import StickyHeader from '../../../StickyHeader'
import { listSentTimeReports } from '@/lib/db/timeReport'
import { listSites } from '@/lib/db/sites'
import SitesCard from './SitesCard'
import { defaultReportMonth, reportMonths } from '@/lib/timeEntries/report'

export async function generateMetadata(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const customer = await getCustomer(params.id)
  return { title: customer?.firma_oder_name ?? 'Kunde' }
}

export default async function KontoPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const customer = await getCustomer(params.id)
  if (!customer) notFound()
  const [invoices, credits, timeEntries, sentReports, sites] = await Promise.all([
    listInvoices({ customerId: customer.id }), listCredits(customer.id), listTimeEntries({ status: 'alle', customerId: customer.id }),
    listSentTimeReports(customer.id).catch(() => []), listSites(customer.id).catch(() => []),
  ])
  const monate = reportMonths(timeEntries)
  const budget = budgetUsage(customer, timeEntries, new Date())
  // Projekt-Auswertung nur, wenn mindestens ein Eintrag einem Projekt zugeordnet ist
  const projekte = timeEntries.some(e => e.projekt) ? projectStats(timeEntries, invoices) : []

  const jahr = new Date().getFullYear()
  const today = new Date().toISOString().slice(0, 10)
  const stats = computeDashboardStats(invoices, 0, jahr, coveredAmounts(invoices, credits))

  const account = computeAccount(invoices, credits)
  // Normale Rechnungen (mit Zahlung), neueste zuerst – listInvoices sortiert bereits absteigend.
  const paymentInvoices = invoices.filter(i => !i.verrechnung_material && i.status !== 'entwurf')
  const owed = computeCustomerOwed(account.saldo, paymentInvoices)
  // Material-Teil nur zeigen, wenn beim Kunden wirklich gegengerechnet wird.
  const materialAktiv = account.rechnungen.length > 0 || credits.length > 0
  const name = customer.firma_oder_name

  return (
    <div className="space-y-6">
      <StickyHeader>
        <div>
          <a href="/admin/kunden" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-1" />Kunden
          </a>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{name}</h1>
              <p className="text-sm text-muted-foreground">Verdienst, offene Beträge und Rechnungen dieses Kunden.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline">
                <a href={`/admin/offerten/neu?kunde=${customer.id}`}><FileText className="h-4 w-4 mr-1.5" />Offerte erstellen</a>
              </Button>
              <Button asChild>
                <a href={`/admin/rechnungen/neu?kunde=${customer.id}`}><FilePlus2 className="h-4 w-4 mr-1.5" />Rechnung erstellen</a>
              </Button>
              <CustomerHeaderActions
                customer={customer} reportMonths={monate} defaultReportMonth={defaultReportMonth(monate, new Date())} sentReports={sentReports}
              />
            </div>
          </div>
        </div>
      </StickyHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
        <StatCard label="Gesamtverdienst" value={<ChfValue amount={stats.gesamtverdienst} />} hint="Alle bezahlten Rechnungen" />
        <StatCard label={`Verdienst ${jahr}`} value={<ChfValue amount={stats.verdienstJahr} />} hint="Bezahlt, nach Rechnungsdatum" />
        <StatCard
          label="Offen"
          value={<ChfValue amount={owed.total} />}
          hint={materialAktiv ? (
            <div className="space-y-0.5 tabular-nums">
              <div className="flex justify-between gap-2"><span>Materialkonto</span><span>{formatChf(owed.konto)}</span></div>
              <div className="flex justify-between gap-2">
                <span>Offene Rechnungen ({owed.offeneAnzahl})</span><span>{formatChf(owed.offeneRechnungen)}</span>
              </div>
              {owed.guthaben > 0 && (
                <div className="flex justify-between gap-2 text-amber-400">
                  <span>Guthaben Material</span><span>{formatChf(owed.guthaben)}</span>
                </div>
              )}
            </div>
          ) : `${owed.offeneAnzahl} versendet, noch nicht bezahlt`}
        />
      </div>

      {budget && (
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <div className="text-sm font-medium">Stundenbudget {budget.label}</div>
              <a href={`/admin/zeiterfassung?kunde=${customer.id}&status=alle`} className="text-xs text-muted-foreground hover:text-foreground hover:underline">Zeiteinträge →</a>
            </div>
            <BudgetBar usage={budget} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <div className="mb-4 text-sm font-medium">{materialAktiv ? 'Rechnungen mit Zahlung' : 'Rechnungen'}</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell">Datum</TableHead>
                <TableHead>Rechnung</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="text-right">Betrag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentInvoices.map(i => {
                const status = i.status === 'bezahlt'
                  ? <Badge variant="outline" className="border-green-500 text-green-400">Bezahlt{i.paid_at ? ` ${formatDatum(i.paid_at)}` : ''}</Badge>
                  : i.status === 'storniert'
                    ? <Badge variant="outline" className="text-muted-foreground line-through">Storniert</Badge>
                    : <Badge>Offen</Badge>
                return (
                  <TableRow key={i.id}>
                    <TableCell className="hidden tabular-nums sm:table-cell">{formatDatum(i.rechnungsdatum)}</TableCell>
                    <TableCell>
                      <InvoicePreviewButton id={i.id} rechnungsnummer={i.rechnungsnummer} className="font-medium wrap-anywhere">
                        {i.rechnungsnummer}
                      </InvoicePreviewButton>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:hidden">
                        <span className="tabular-nums">{formatDatum(i.rechnungsdatum)}</span>{status}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{status}</TableCell>
                    <TableCell className="text-right tabular-nums align-top sm:align-middle">{formatBetrag(Number(i.betrag), { tabelle: true })}</TableCell>
                  </TableRow>
                )
              })}
              {paymentInvoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Noch keine versendeten Rechnungen.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {projekte.length > 0 && <ProjectsCard rows={projekte} />}

      <SitesCard customerId={customer.id} sites={sites} />

      <MaterialSection customerId={customer.id} today={today} invoices={invoices} credits={credits} />
    </div>
  )
}
