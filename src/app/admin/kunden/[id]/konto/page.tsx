import { notFound } from 'next/navigation'
import { ArrowLeft, FilePlus2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCustomer } from '@/lib/db/customers'
import { getSettings } from '@/lib/db/settings'
import { listProjectRates } from '@/lib/db/rates'
import { ansaetzeAus } from '@/lib/timeEntries/rates'
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
import { hoursOverview } from '@/lib/timeEntries/hoursOverview'
import HoursCard, { OpenHoursCard } from '../../../HoursCard'
import GuthabenCard from '../../../GuthabenCard'
import GuthabenDialog, { GuthabenAufsKonto, GuthabenLoeschen } from './GuthabenDialog'
import { listGuthaben } from '@/lib/db/guthaben'
import { angerechnet, guthabenSaldo, guthabenVerlauf, zuBezahlen } from '@/lib/invoices/guthaben'

export async function generateMetadata(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const customer = await getCustomer(params.id)
  return { title: customer?.firma_oder_name ?? 'Kunde' }
}

export default async function KontoPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const customer = await getCustomer(params.id)
  if (!customer) notFound()
  const [invoices, credits, timeEntries, sentReports, sites, guthaben, settings, projektAnsaetze] = await Promise.all([
    listInvoices({ customerId: customer.id }), listCredits(customer.id), listTimeEntries({ status: 'alle', customerId: customer.id }),
    listSentTimeReports(customer.id).catch(() => []), listSites(customer.id).catch(() => []), listGuthaben(customer.id),
    getSettings(), listProjectRates(customer.id).catch(() => []),
  ])
  const guthabenFrei = guthabenSaldo(guthaben, invoices)
  const monate = reportMonths(timeEntries)
  const budget = budgetUsage(customer, timeEntries, new Date())
  // Projekt-Auswertung nur, wenn mindestens ein Eintrag einem Projekt zugeordnet ist
  const projekte = timeEntries.some(e => e.projekt) ? projectStats(timeEntries, invoices) : []
  const stunden = hoursOverview(timeEntries, invoices)
  const ansaetze = ansaetzeAus(settings.standard_stundensatz, [customer], projektAnsaetze)

  const jahr = new Date().getFullYear()
  const today = new Date().toISOString().slice(0, 10)
  const stats = computeDashboardStats(invoices, 0, jahr, coveredAmounts(invoices, credits))

  const account = computeAccount(invoices, credits)
  // Normale Rechnungen (mit Zahlung) inkl. Entwürfen, neueste zuerst – listInvoices sortiert bereits absteigend.
  // «Offen» zählt nur versendete (computeCustomerOwed), Entwürfe stehen nur in der Liste.
  const paymentInvoices = invoices.filter(i => !i.verrechnung_material)
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
                customer={customer} reportMonths={monate} defaultReportMonth={defaultReportMonth(monate, new Date())} sentReports={sentReports} standardAnsatz={settings.standard_stundensatz}
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
              {guthabenFrei > 0 && (
                <div className="flex justify-between gap-2 text-amber-400"><span>Guthaben</span><span>{formatChf(guthabenFrei)}</span></div>
              )}
            </div>
          ) : (
            <>
              {owed.offeneAnzahl} versendet, noch nicht bezahlt
              {guthabenFrei > 0 && <span className="block text-amber-400 tabular-nums">Guthaben {formatChf(guthabenFrei)}, noch nicht angerechnet</span>}
            </>
          )}
        />
      </div>

      {budget && (
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="karte-titel -mt-3 flex items-baseline justify-between gap-4 py-3">
              <h2 className="text-sm font-medium">Stundenbudget {budget.label}</h2>
              <a href={`/admin/zeiterfassung?kunde=${customer.id}&status=alle`} className="text-xs text-muted-foreground hover:text-foreground hover:underline">Zeiteinträge →</a>
            </div>
            <BudgetBar usage={budget} />
          </CardContent>
        </Card>
      )}

      <OpenHoursCard gruppe={stunden.offen} link={`/admin/zeiterfassung?kunde=${customer.id}&status=offen`} />

      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <div className="karte-titel -mt-3 mb-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
            <h2 className="text-sm font-medium">{materialAktiv ? 'Rechnungen mit Zahlung' : 'Rechnungen'}</h2>
            <GuthabenDialog
              customerId={customer.id}
              today={today}
              rechnungen={paymentInvoices.filter(i => i.status === 'versendet' || i.status === 'bezahlt').map(i => ({ id: i.id, rechnungsnummer: i.rechnungsnummer }))}
              materialkonto={materialAktiv ? { offen: owed.konto } : undefined}
            />
          </div>
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
                    : i.status === 'entwurf'
                      ? <Badge variant="secondary">Entwurf</Badge>
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
                    <TableCell className="text-right tabular-nums align-top sm:align-middle">
                      {formatBetrag(Number(i.betrag), { tabelle: true })}
                      {angerechnet(i) > 0 && i.status !== 'storniert' && (
                        <span className="block text-xs text-muted-foreground">
                          − {formatBetrag(angerechnet(i), { tabelle: true })} Guthaben<br />zu bezahlen {formatBetrag(zuBezahlen(i), { tabelle: true })}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
              {paymentInvoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Noch keine Rechnungen.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <GuthabenCard
        verlauf={guthabenVerlauf(guthaben, invoices)}
        saldo={guthabenFrei}
        aktion={e => (
          <div className="flex justify-end">
            {materialAktiv && <GuthabenAufsKonto id={e.id} beschreibung={e.beschreibung} betrag={Number(e.betrag)} />}
            <GuthabenLoeschen id={e.id} beschreibung={e.beschreibung} />
          </div>
        )}
      />

      <HoursCard
        {...stunden}
        ohneOffen
        rechnungLink={r => (
          <InvoicePreviewButton id={r.id} rechnungsnummer={r.rechnungsnummer} className="wrap-anywhere">{r.rechnungsnummer}</InvoicePreviewButton>
        )}
      />

      {projekte.length > 0 && <ProjectsCard rows={projekte} customerId={customer.id} ansaetze={ansaetze} />}

      <SitesCard customerId={customer.id} sites={sites} />

      <MaterialSection customerId={customer.id} today={today} invoices={invoices} credits={credits} />
    </div>
  )
}
