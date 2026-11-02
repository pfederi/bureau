import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { formatBetrag, formatChf } from '@/lib/invoices/stats'
import { formatDatum } from '@/lib/utils'
import type { GuthabenEintrag, GuthabenZeile } from '@/lib/invoices/guthaben'

/** Guthaben des Kunden (z. B. Überzahlungen) mit Anrechnungen – im Kundenkonto und auf der Kundenseite. */
export default function GuthabenCard({ verlauf, saldo, aktion }: {
  verlauf: GuthabenZeile[]
  saldo: number
  /** z. B. Löschknopf pro Guthaben (nur Admin) */
  aktion?: (eintrag: GuthabenEintrag) => ReactNode
}) {
  if (verlauf.length === 0) return null
  return (
    <Card>
      <CardContent className="pt-4 sm:pt-6">
        <div className="karte-titel -mt-3 mb-1 flex flex-wrap items-baseline justify-between gap-x-4 py-3">
          <h2 className="text-sm font-medium">Guthaben</h2>
          <span className="text-sm tabular-nums text-muted-foreground">{formatChf(saldo)} verfügbar</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden sm:table-cell">Datum</TableHead>
              <TableHead>Beschreibung</TableHead>
              <TableHead className="text-right">Betrag</TableHead>
              {aktion && <TableHead className="w-px"><span className="sr-only">Aktionen</span></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {verlauf.map(z => (
              <TableRow key={z.key}>
                <TableCell className="hidden whitespace-nowrap tabular-nums sm:table-cell">{formatDatum(z.datum)}</TableCell>
                <TableCell>
                  <div className="wrap-anywhere">{z.text}</div>
                  <div className="mt-1 text-xs tabular-nums text-muted-foreground sm:hidden">{formatDatum(z.datum)}</div>
                </TableCell>
                <TableCell className={`whitespace-nowrap text-right tabular-nums ${z.betrag > 0 ? 'text-green-400' : ''}`}>
                  {z.betrag > 0 ? '+ ' : '− '}{formatBetrag(Math.abs(z.betrag), { tabelle: true })}
                </TableCell>
                {aktion && <TableCell className="py-1 text-right">{z.eintrag && aktion(z.eintrag)}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
