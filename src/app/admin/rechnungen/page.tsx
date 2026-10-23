import { listInvoices, listHostingBilled } from '@/lib/db/invoices'
import { listCustomers } from '@/lib/db/customers'
import { formatChf } from '@/lib/invoices/stats'
import InvoiceActions from '../InvoiceActions'
import InvoiceFilterBar from './InvoiceFilterBar'
import HostingBulkDialog from './HostingBulkDialog'
import type { InvoiceStatus } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { FilePlus2 } from 'lucide-react'
import { formatDatum } from '@/lib/utils'
import StickyHeader from '../StickyHeader'

export const metadata = { title: 'Rechnungen' }

const badgeVariant: Record<InvoiceStatus, 'secondary' | 'default' | 'outline'> = {
  entwurf: 'secondary', versendet: 'default', bezahlt: 'outline', storniert: 'outline',
}
const badgeExtra: Record<InvoiceStatus, string> = {
  entwurf: '', versendet: '', bezahlt: 'border-green-500 text-green-400', storniert: 'text-muted-foreground line-through',
}
const label: Record<InvoiceStatus, string> = { entwurf: 'Entwurf', versendet: 'Versendet', bezahlt: 'Bezahlt', storniert: 'Storniert' }

export default async function RechnungenPage(
  props: {
    searchParams: Promise<{ kunde?: string; jahr?: string; status?: string; hosting?: string }>
  }
) {
  const searchParams = await props.searchParams
  const jahr = searchParams.jahr || String(new Date().getFullYear())
  // Unbekannte Werte aus der URL ignorieren statt die Abfrage scheitern zu lassen.
  const status = (Object.keys(label) as InvoiceStatus[]).find(s => s === searchParams.status)
  const [invoices, customers, hostingBilled] = await Promise.all([
    listInvoices({ customerId: searchParams.kunde, jahr: jahr === 'alle' ? undefined : jahr, status }),
    listCustomers(),
    listHostingBilled(),
  ])
  return (
    <div className="space-y-6">
      <StickyHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Rechnungen</h1>
            <p className="text-sm text-muted-foreground">Übersicht aller Rechnungen und deren Status.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <HostingBulkDialog customers={customers} hostingBilled={hostingBilled} initialJahr={searchParams.hosting} />
            <Button asChild>
              <a href="/admin/rechnungen/neu"><FilePlus2 className="h-4 w-4 mr-1.5" />Neue Rechnung</a>
            </Button>
          </div>
        </div>
        <InvoiceFilterBar customers={customers} customerId={searchParams.kunde ?? ''} jahr={jahr} status={status ?? ''} />
      </StickyHeader>
      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nummer</TableHead>
                <TableHead className="hidden md:table-cell">Kunde</TableHead>
                <TableHead className="hidden md:table-cell">Datum</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Betrag</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map(inv => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <span className="block whitespace-nowrap font-medium">{inv.rechnungsnummer}</span>
                    {/* Handy: Kunde und Datum als zweite Zeile statt eigener Spalten */}
                    <span className="block text-xs text-muted-foreground md:hidden">{inv.customer?.firma_oder_name} · {formatDatum(inv.rechnungsdatum)}</span>
                    <span className="mt-1 flex items-center gap-2 sm:hidden">
                      <span className="text-sm tabular-nums">{formatChf(Number(inv.betrag))}</span>
                      <Badge variant={badgeVariant[inv.status]} className={badgeExtra[inv.status]}>{label[inv.status]}</Badge>
                    </span>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap md:table-cell">{inv.customer?.firma_oder_name}</TableCell>
                  <TableCell className="hidden tabular-nums md:table-cell">{formatDatum(inv.rechnungsdatum)}</TableCell>
                  <TableCell className="hidden whitespace-nowrap text-right tabular-nums sm:table-cell">{formatChf(Number(inv.betrag), { tabelle: true })}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={badgeVariant[inv.status]} className={badgeExtra[inv.status]}>
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                      {label[inv.status]}
                    </Badge>
                    {inv.status === 'versendet' && inv.erinnert_am && (
                      <span className="ml-1.5 text-xs text-muted-foreground" title="Zuletzt erinnert">erinnert {formatDatum(inv.erinnert_am)}</span>
                    )}
                    {inv.verrechnung_material && (
                      <Badge variant="outline" className="ml-1.5 text-muted-foreground" title="Wird mit Material verrechnet">Konto</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right"><InvoiceActions id={inv.id} rechnungsnummer={inv.rechnungsnummer} status={inv.status} customerId={inv.customer_id} verrechnung={inv.verrechnung_material} erinnertAm={inv.erinnert_am} /></TableCell>
                </TableRow>
              ))}
              {invoices.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Keine Rechnungen für diesen Filter.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
