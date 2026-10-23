import { listQuotes } from '@/lib/db/quotes'
import { listCustomers } from '@/lib/db/customers'
import { formatChf } from '@/lib/invoices/stats'
import { formatDatum } from '@/lib/utils'
import type { QuoteStatus } from '@/lib/types'
import InvoiceFilterBar from '../rechnungen/InvoiceFilterBar'
import QuoteActions from './QuoteActions'
import { quoteStatusLabel } from '@/lib/quotes'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { FilePlus2 } from 'lucide-react'
import StickyHeader from '../StickyHeader'

export const metadata = { title: 'Offerten' }

const STATUS: QuoteStatus[] = ['entwurf', 'versendet', 'angenommen', 'abgelehnt']
const badge: Record<QuoteStatus, { variant: 'secondary' | 'default' | 'outline'; className: string }> = {
  entwurf: { variant: 'secondary', className: '' },
  versendet: { variant: 'default', className: '' },
  angenommen: { variant: 'outline', className: 'border-green-500 text-green-400' },
  abgelehnt: { variant: 'outline', className: 'text-muted-foreground' },
}

export default async function OffertenPage(
  props: { searchParams: Promise<{ kunde?: string; jahr?: string; status?: string }> }
) {
  const searchParams = await props.searchParams
  const jahr = searchParams.jahr || String(new Date().getFullYear())
  const status = STATUS.find(s => s === searchParams.status)
  const [quotes, customers] = await Promise.all([
    listQuotes({ customerId: searchParams.kunde, jahr: jahr === 'alle' ? undefined : jahr, status }),
    listCustomers(),
  ])
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div className="space-y-6">
      <StickyHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Offerten</h1>
            <p className="text-sm text-muted-foreground">Offerten erstellen, versenden und in Rechnungen umwandeln.</p>
          </div>
          <Button asChild>
            <a href={`/admin/offerten/neu${searchParams.kunde ? `?kunde=${searchParams.kunde}` : ''}`}><FilePlus2 className="h-4 w-4 mr-1.5" />Neue Offerte</a>
          </Button>
        </div>
        <InvoiceFilterBar
          customers={customers}
          customerId={searchParams.kunde ?? ''}
          jahr={jahr}
          status={status ?? ''}
          statusOptions={STATUS.map(s => ({ value: s, label: quoteStatusLabel[s] }))}
        />
      </StickyHeader>
      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nummer</TableHead>
                <TableHead className="hidden md:table-cell">Kunde</TableHead>
                <TableHead className="hidden md:table-cell">Datum</TableHead>
                <TableHead className="hidden lg:table-cell">Gültig bis</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Betrag</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map(q => {
                const abgelaufen = q.status === 'versendet' && q.gueltig_bis !== null && q.gueltig_bis < today
                return (
                  <TableRow key={q.id}>
                    <TableCell>
                      <span className="block whitespace-nowrap font-medium">{q.offertnummer}</span>
                      {/* Handy: Kunde, Datum und Gültigkeit als zweite Zeile */}
                      <span className="block text-xs text-muted-foreground md:hidden">{q.customer?.firma_oder_name} · {formatDatum(q.offertdatum)}</span>
                      {q.gueltig_bis && (
                        <span className={abgelaufen ? 'block text-xs text-amber-400 lg:hidden' : 'block text-xs text-muted-foreground lg:hidden'}>
                          gültig bis {formatDatum(q.gueltig_bis)}{abgelaufen && ' (abgelaufen)'}
                        </span>
                      )}
                      <span className="mt-1 flex items-center gap-2 sm:hidden">
                        <span className="text-sm tabular-nums">{formatChf(Number(q.betrag))}</span>
                        <Badge variant={badge[q.status].variant} className={badge[q.status].className}>{quoteStatusLabel[q.status]}</Badge>
                      </span>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap md:table-cell">{q.customer?.firma_oder_name}</TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">{formatDatum(q.offertdatum)}</TableCell>
                    <TableCell className={abgelaufen ? 'hidden tabular-nums text-amber-400 lg:table-cell' : 'hidden tabular-nums lg:table-cell'}>
                      {formatDatum(q.gueltig_bis)}{abgelaufen && ' (abgelaufen)'}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-right tabular-nums sm:table-cell">{formatChf(Number(q.betrag), { tabelle: true })}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={badge[q.status].variant} className={badge[q.status].className}>
                        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                        {quoteStatusLabel[q.status]}
                      </Badge>
                      {q.invoice_id && <Badge variant="outline" className="ml-1.5 text-muted-foreground">Verrechnet</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <QuoteActions id={q.id} offertnummer={q.offertnummer} status={q.status} invoiceId={q.invoice_id} />
                    </TableCell>
                  </TableRow>
                )
              })}
              {quotes.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Keine Offerten für diesen Filter.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
