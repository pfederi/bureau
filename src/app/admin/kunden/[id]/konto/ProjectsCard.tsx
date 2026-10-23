import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { formatBetrag, formatChf, formatStunden } from '@/lib/invoices/stats'
import type { ProjectStat } from '@/lib/timeEntries/projectStats'

const jahr = (iso: string) => iso.slice(0, 4)
const zeitraum = (r: ProjectStat) => (jahr(r.von) === jahr(r.bis) ? jahr(r.von) : `${jahr(r.von)}–${jahr(r.bis)}`)

/** Stunden und Ertrag pro Projekt; «pro Std.» = verrechnet nach Rabatt durch verrechnete Stunden. */
export default function ProjectsCard({ rows }: { rows: ProjectStat[] }) {
  return (
    <Card>
      <CardContent className="pt-4 sm:pt-6">
        <h2 className="text-sm font-medium">Projekte</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Erfasste Stunden pro Projekt. „Pro Std.“ ist der effektive Ansatz: verrechneter Betrag nach Rabatt durch die verrechneten Stunden.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projekt</TableHead>
              <TableHead className="hidden sm:table-cell">Zeitraum</TableHead>
              <TableHead className="text-right">Std.</TableHead>
              <TableHead className="hidden text-right md:table-cell">Verrechnet</TableHead>
              <TableHead className="text-right">Pro Std.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.projekt ?? '—'}>
                <TableCell>
                  <div className={r.projekt ? 'font-medium' : 'text-muted-foreground'}>{r.projekt ?? 'Ohne Projekt'}</div>
                  <div className="text-xs text-muted-foreground sm:hidden">{zeitraum(r)}</div>
                  {r.offen > 0 && <div className="text-xs text-muted-foreground">davon offen {formatChf(r.offen)}</div>}
                </TableCell>
                <TableCell className="hidden tabular-nums sm:table-cell">{zeitraum(r)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatStunden(r.stunden)}</TableCell>
                <TableCell className="hidden whitespace-nowrap text-right tabular-nums md:table-cell">{formatBetrag(r.verrechnet, { tabelle: true })}</TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums">{r.effektiv !== null ? formatBetrag(r.effektiv, { tabelle: true }) : '–'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
