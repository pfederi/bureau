import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Sora } from 'next/font/google'
import { FileText } from 'lucide-react'
import { loadPortal } from '@/lib/db/portal'
import { portalAnbieter } from '@/lib/portal/path'
import { edition } from '@/edition'
import { computeAccount, computeCustomerOwed } from '@/lib/invoices/account'
import { budgetUsage } from '@/lib/invoices/budget'
import { formatBetrag, formatChf } from '@/lib/invoices/stats'
import { formatDatum } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { BudgetBar, ChfValue } from '@/app/admin/DashboardWidgets'
import { PortalMaterialSection } from '@/modules/material'
import BodyClass from '@/app/admin/BodyClass'

const sora = Sora({ subsets: ['latin'], weight: ['300', '400', '500', '600'] })

export const dynamic = 'force-dynamic'

// Privater Link: nicht in Suchmaschinen, Token nicht als Referrer weitergeben
export async function generateMetadata(props: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const params = await props.params
  // Mit festem Namen der Edition ohne Datenbankabfrage, sonst Absender aus den Einstellungen
  const anbieter = portalAnbieter(edition.portalName, edition.portalName ? null : (await loadPortal(params.token))?.settings.absender_name)
  return {
    title: anbieter ? `Kundenkonto · ${anbieter}` : 'Kundenkonto',
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  }
}

export default async function KundenSeite(props: { params: Promise<{ token: string }> }) {
  const params = await props.params
  const data = await loadPortal(params.token)
  if (!data) notFound()
  const { customer, invoices, credits, timeEntries, settings } = data
  const anbieter = portalAnbieter(edition.portalName, settings.absender_name)

  const offeneUndBezahlte = invoices.filter(i => !i.verrechnung_material && i.status !== 'storniert')
  const account = computeAccount(invoices, credits)
  const materialAktiv = account.rechnungen.length > 0 || credits.length > 0
  const owed = computeCustomerOwed(account.saldo, offeneUndBezahlte)
  const budget = budgetUsage(customer, timeEntries, new Date())
  const pdf = (id: string) => `/kunde/${params.token}/rechnung/${id}`

  return (
    <div lang="de" className={`admin-dark ${sora.className} min-h-screen bg-background text-foreground`}>
      <BodyClass className={`admin-dark ${sora.className}`} />
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:py-12">
        <header>
          <div className="text-sm text-muted-foreground">{anbieter ? `${anbieter} · ` : ''}Kundenkonto</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{customer.firma_oder_name}</h1>
          <p className="text-sm text-muted-foreground">Stand {formatDatum(new Date().toISOString().slice(0, 10))}</p>
        </header>

        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="text-sm text-muted-foreground">Offen</div>
            <div className="mt-2 text-2xl font-medium tracking-tight tabular-nums sm:text-3xl"><ChfValue amount={owed.total} /></div>
            <div className="mt-2 space-y-0.5 text-xs tabular-nums text-muted-foreground">
              <div className="flex justify-between gap-2">
                <span>Offene Rechnungen ({owed.offeneAnzahl})</span><span>{formatChf(owed.offeneRechnungen)}</span>
              </div>
              {materialAktiv && (
                <div className="flex justify-between gap-2"><span>Materialkonto</span><span>{formatChf(owed.konto)}</span></div>
              )}
              {owed.guthaben > 0 && (
                <div className="flex justify-between gap-2"><span>Guthaben Material</span><span>{formatChf(owed.guthaben)}</span></div>
              )}
            </div>
          </CardContent>
        </Card>

        {budget && (
          <Card>
            <CardContent className="pt-4 sm:pt-6">
              <h2 className="mb-3 text-sm font-medium">Stundenbudget {budget.label}</h2>
              <BudgetBar usage={budget} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <h2 className="mb-4 text-sm font-medium">{materialAktiv ? 'Rechnungen mit Zahlung' : 'Rechnungen'}</h2>
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
                {offeneUndBezahlte.map(i => {
                  const status = i.status === 'bezahlt'
                    ? <Badge variant="outline" className="border-green-500 text-green-400">Bezahlt{i.paid_at ? ` ${formatDatum(i.paid_at)}` : ''}</Badge>
                    : <Badge>Offen</Badge>
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="hidden tabular-nums sm:table-cell">{formatDatum(i.rechnungsdatum)}</TableCell>
                      <TableCell>
                        <a href={pdf(i.id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-sm font-medium text-blue-300 underline-offset-4 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring wrap-anywhere">
                          <FileText className="h-4 w-4 shrink-0" aria-hidden />{i.rechnungsnummer}
                          <span className="sr-only">(PDF, öffnet in neuem Fenster)</span>
                        </a>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:hidden">
                          <span className="tabular-nums">{formatDatum(i.rechnungsdatum)}</span>{status}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{status}</TableCell>
                      <TableCell className="text-right tabular-nums align-top sm:align-middle">{formatBetrag(Number(i.betrag), { tabelle: true })}</TableCell>
                    </TableRow>
                  )
                })}
                {offeneUndBezahlte.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Noch keine Rechnungen.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <PortalMaterialSection invoices={invoices} credits={credits} pdfHref={pdf} />

        <footer className="pt-2 text-sm text-muted-foreground">
          Fragen? {settings.absender_name}
          {settings.absender_email && <>, <a href={`mailto:${settings.absender_email}`} className="rounded-sm text-blue-300 underline-offset-4 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">{settings.absender_email}</a></>}
        </footer>
      </div>
    </div>
  )
}
