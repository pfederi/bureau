import { Card, CardContent } from '@/components/ui/card'
import { formatBetrag, formatChf } from '@/lib/invoices/stats'
import { cn } from '@/lib/utils'

export type YearRow = { jahr: number; einnahmen: number; ausgaben: number; gewinn: number }

/** Einnahmen und Ausgaben pro Jahr (nach Zahlungseingang wie im Jahresabschluss), Gewinn darunter. */
export default function YearComparison({ rows, className }: { rows: YearRow[]; className?: string }) {
  const max = Math.max(1, ...rows.flatMap(r => [r.einnahmen, r.ausgaben]))
  const total = rows.reduce((s, r) => s + r.gewinn, 0)
  const aktuell = rows[rows.length - 1]?.jahr
  return (
    <Card className={className}>
      <CardContent className="pt-4 sm:pt-6">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">Jahresvergleich</h2>
            <div className="text-xs text-muted-foreground">Einnahmen nach Zahlungseingang, Ausgaben und Gewinn</div>
          </div>
          <div className="shrink-0 whitespace-nowrap text-right text-sm font-medium tabular-nums" title="Gewinn aller Jahre">{formatChf(total)}</div>
        </div>

        {/* Diagramm nur visuell; die Werte stehen für Screenreader in der Tabelle darunter */}
        <div className="relative h-40" aria-hidden>
          {[0, 0.5, 1].map(f => (
            <div key={f} className="absolute inset-x-0 border-t border-dashed border-border" style={{ bottom: `${f * 100}%` }} />
          ))}
          <div className="relative flex h-full items-end gap-2 sm:gap-4">
            {rows.map((r, i) => (
              <div key={r.jahr} className="flex h-full flex-1 items-end justify-center gap-1" title={`${r.jahr}: Einnahmen ${formatChf(r.einnahmen)}, Ausgaben ${formatChf(r.ausgaben)}`}>
                <div className="w-1/3 max-w-6 origin-bottom rounded-t bg-blue-400 motion-safe:animate-wachsen-y" style={{ height: `${(r.einnahmen / max) * 100}%`, animationDelay: `${i * 60}ms` }} />
                <div className="w-1/3 max-w-6 origin-bottom rounded-t bg-rose-400 motion-safe:animate-wachsen-y" style={{ height: `${(r.ausgaben / max) * 100}%`, animationDelay: `${i * 60 + 30}ms` }} />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex gap-2 sm:gap-4" aria-hidden>
          {rows.map(r => (
            <div key={r.jahr} className="min-w-0 flex-1 text-center">
              <div className={cn('text-xs', r.jahr === aktuell ? 'font-medium text-foreground' : 'text-muted-foreground')}>{r.jahr}</div>
              <div className={cn('truncate text-[11px] tabular-nums', r.gewinn < 0 ? 'text-red-300' : 'text-muted-foreground')}>
                {formatBetrag(r.gewinn, { tabelle: true })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-400" />Einnahmen</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400" />Ausgaben</span>
          <span>Zahl unter dem Jahr: Gewinn</span>
        </div>

        <table className="sr-only">
          <caption>Jahresvergleich</caption>
          <thead><tr><th>Jahr</th><th>Einnahmen</th><th>Ausgaben</th><th>Gewinn</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.jahr}><td>{r.jahr}</td><td>{formatChf(r.einnahmen)}</td><td>{formatChf(r.ausgaben)}</td><td>{formatChf(r.gewinn)}</td></tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
