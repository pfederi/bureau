import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { formatBetrag, formatChf, formatStunden } from '@/lib/invoices/stats'
import type { ProjectStat } from '@/lib/timeEntries/projectStats'
import { vorgeschlagenerAnsatz, projektAnsatz, type Ansaetze } from '@/lib/timeEntries/rates'
import ProjectRateButton from './ProjectRateButton'

const jahr = (iso: string) => iso.slice(0, 4)
const zeitraum = (r: ProjectStat) => (jahr(r.von) === jahr(r.bis) ? jahr(r.von) : `${jahr(r.von)}–${jahr(r.bis)}`)
const HERKUNFT = { projekt: '', kunde: ' (Kunde)', standard: ' (Standard)' } as const

/** Stunden und Ertrag pro Projekt; «pro Std.» = verrechnet nach Rabatt durch verrechnete Stunden. */
export default function ProjectsCard({ rows, customerId, ansaetze }: { rows: ProjectStat[]; customerId: string; ansaetze: Ansaetze }) {
  return (
    <Card>
      <CardContent className="pt-4 sm:pt-6">
        <h2 className="karte-titel -mt-3 py-3 text-sm font-medium">Projekte</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Erfasste Stunden pro Projekt. „Pro Std.“ ist der effektive Ansatz: verrechneter Betrag nach Rabatt durch die verrechneten Stunden. „Ansatz“ ist der Vorschlag für neue Einträge; der Stift ändert ihn pro Projekt.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projekt</TableHead>
              <TableHead className="hidden sm:table-cell">Zeitraum</TableHead>
              <TableHead className="text-right">Std.</TableHead>
              <TableHead className="hidden text-right md:table-cell">Verrechnet</TableHead>
              <TableHead className="text-right">Pro Std.</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Ansatz</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => {
              const v = vorgeschlagenerAnsatz(ansaetze, customerId, r.projekt)
              const knopf = r.projekt && <ProjectRateButton customerId={customerId} projekt={r.projekt} projektAnsatz={projektAnsatz(ansaetze.projekte, customerId, r.projekt)} />
              return (
                <TableRow key={r.projekt ?? '—'}>
                  <TableCell>
                    <div className={r.projekt ? 'font-medium' : 'text-muted-foreground'}>{r.projekt ?? 'Ohne Projekt'}</div>
                    <div className="text-xs text-muted-foreground sm:hidden">{zeitraum(r)}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground sm:hidden">Ansatz {formatBetrag(v.ansatz)}{HERKUNFT[v.quelle]}{knopf}</div>
                    {r.offen > 0 && <div className="text-xs text-muted-foreground">davon offen {formatChf(r.offen)}</div>}
                  </TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell">{zeitraum(r)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatStunden(r.stunden)}</TableCell>
                  <TableCell className="hidden whitespace-nowrap text-right tabular-nums md:table-cell">{formatBetrag(r.verrechnet, { tabelle: true })}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">{r.effektiv !== null ? formatBetrag(r.effektiv, { tabelle: true }) : '–'}</TableCell>
                  <TableCell className="hidden whitespace-nowrap text-right tabular-nums sm:table-cell">
                    <span className="inline-flex items-center justify-end gap-1">
                      <span>{formatBetrag(v.ansatz, { tabelle: true })}<span className="text-muted-foreground">{HERKUNFT[v.quelle]}</span></span>
                      {knopf}
                    </span>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
