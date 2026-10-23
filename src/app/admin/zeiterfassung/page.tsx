import { listTimeEntries, listProjectNames, type TimeEntryStatusFilter } from '@/lib/db/timeEntries'
import { listCustomers } from '@/lib/db/customers'
import { getSettings } from '@/lib/db/settings'
import TimeEntryForm, { DuplicateTimeEntryButton } from './TimeEntryForm'
import TimeEntryActions from './TimeEntryActions'
import TimeEntryFilterBar from './TimeEntryFilterBar'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatDatum } from '@/lib/utils'
import StickyHeader from '../StickyHeader'
import { formatStunden } from '@/lib/invoices/stats'

export const metadata = { title: 'Zeiterfassung' }

const STATUS_VALUES: TimeEntryStatusFilter[] = ['offen', 'verrechnet', 'alle']

export default async function ZeiterfassungPage(
  props: {
    searchParams: Promise<{ status?: string; tab?: string; kunde?: string; jahr?: string }>
  }
) {
  const searchParams = await props.searchParams
  // `tab` stammt aus der früheren Tab-Ansicht (alte Links/Lesezeichen).
  const status = STATUS_VALUES.find(s => s === (searchParams.status ?? searchParams.tab)) ?? 'offen'
  const kunde = searchParams.kunde ?? ''
  // Standard: offene Einträge aller Jahre (sonst verschwinden offene aus dem Vorjahr), sonst laufendes Jahr.
  const jahr = searchParams.jahr === 'alle'
    ? ''
    : searchParams.jahr || (status === 'offen' ? '' : String(new Date().getFullYear()))
  const [customers, settings, entries, projekte] = await Promise.all([
    listCustomers(),
    getSettings(),
    listTimeEntries({ status, customerId: kunde || undefined, jahr: jahr || undefined }),
    listProjectNames(),
  ])
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <StickyHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Zeiterfassung</h1>
            <p className="text-sm text-muted-foreground">Arbeitszeiten erfassen und für Rechnungen nutzen.</p>
          </div>
          <TimeEntryForm customers={customers} defaultRate={settings.standard_stundensatz} today={today} defaultCustomerId={kunde} />
        </div>

        <TimeEntryFilterBar status={status} customers={customers} customerId={kunde} jahr={jahr} />
      </StickyHeader>
      {/* Vorschläge für das Projektfeld in den Erfassen-/Bearbeiten-Dialogen */}
      <datalist id="projekt-vorschlaege">{projekte.map(p => <option key={p} value={p} />)}</datalist>

      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden md:table-cell">Datum</TableHead><TableHead className="hidden md:table-cell">Kunde</TableHead><TableHead>Beschreibung</TableHead><TableHead className="text-right">Std.</TableHead><TableHead className="hidden lg:table-cell">Satz</TableHead><TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="hidden tabular-nums md:table-cell">{formatDatum(e.datum)}</TableCell>
                  <TableCell className="hidden whitespace-nowrap md:table-cell">{e.customer?.firma_oder_name}</TableCell>
                  <TableCell>
                    {e.projekt && <span className="mb-0.5 block text-xs font-medium text-blue-300">{e.projekt}</span>}
                    <span className="block whitespace-pre-line">{e.beschreibung}</span>
                    {/* Handy: Datum, Kunde und Status als zweite Zeile */}
                    <span className="block text-xs text-muted-foreground md:hidden">
                      {formatDatum(e.datum)} · {e.customer?.firma_oder_name}<span className="sm:hidden"> · {e.billed ? 'verrechnet' : 'offen'}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatStunden(Number(e.stunden))}</TableCell>
                  <TableCell className="hidden lg:table-cell">{e.stundensatz}</TableCell>
                  <TableCell className="hidden sm:table-cell">{e.billed ? <Badge variant="secondary">verrechnet</Badge> : <Badge>offen</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <DuplicateTimeEntryButton entry={e} customers={customers} today={today} />
                      {/* Verrechnete Einträge gehören zu einer Rechnung und bleiben unveränderbar. */}
                      {e.billed ? <span className="w-9" aria-hidden /> : <TimeEntryActions entry={e} customers={customers} />}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Keine Einträge für diesen Filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
