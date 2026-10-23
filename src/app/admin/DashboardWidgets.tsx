import type { ReactNode } from 'react'
import { formatChf, formatBetrag, formatZahl, formatStunden, type MonthlyRevenue } from '@/lib/invoices/stats'
import { cn } from '@/lib/utils'
import type { BudgetUsage } from '@/lib/invoices/budget'
import { Card, CardContent } from '@/components/ui/card'

// Gemeinsame Bausteine für das Dashboard (Home) und das Kunden-Dashboard (Konto).

export function StatCard({ label, value, hint, className }: { label: string; value: ReactNode; hint: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardContent className="pt-4 sm:pt-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-2 text-xl font-medium tracking-tight tabular-nums sm:text-3xl">{value}</div>
        <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  )
}

export function ChfValue({ amount }: { amount: number }) {
  return (
    <>
      <span className="mr-1 text-sm font-medium text-muted-foreground sm:mr-1.5 sm:text-base">Fr.</span>
      {formatBetrag(amount)}
    </>
  )
}


// Gut unterscheidbare, helle Töne für den dunklen Hintergrund. Volle Klassennamen,
// damit Tailwind sie findet.
const PALETTE = [
  'bg-blue-400', 'bg-teal-400', 'bg-amber-400', 'bg-violet-400', 'bg-rose-400',
  'bg-emerald-400', 'bg-sky-300', 'bg-orange-400', 'bg-fuchsia-400', 'bg-lime-400',
]

// Dieselben Töne als Farbwert, für SVG (Donut), wo Tailwind-Hintergrundklassen nicht greifen –
// Werte der Tailwind-4-Farben (OKLCH in sRGB umgerechnet), damit Donut und Balken übereinstimmen.
const PALETTE_HEX: Record<string, string> = {
  'bg-blue-400': '#51a2ff', 'bg-teal-400': '#00d5be', 'bg-amber-400': '#ffb900', 'bg-violet-400': '#a684ff', 'bg-rose-400': '#ff637e',
  'bg-emerald-400': '#00d492', 'bg-sky-300': '#74d4ff', 'bg-orange-400': '#ff8904', 'bg-fuchsia-400': '#ed6aff', 'bg-lime-400': '#9ae600',
}
export const colorHex = (bgClass: string | undefined) => PALETTE_HEX[bgClass ?? ''] ?? '#90a1b9'

/** Feste Farbe pro Kunde (Reihenfolge der Kundenliste), in allen Diagrammen gleich. */
export function customerColors(customerIds: string[]): Record<string, string> {
  return Object.fromEntries(customerIds.map((id, i) => [id, PALETTE[i % PALETTE.length]]))
}

type ChartProps = { data: MonthlyRevenue[]; colors: Record<string, string>; className?: string }

/** Gestapeltes Balkendiagramm (pro Kunde) für Monatswerte, mit Tooltip und Legende. */
function MonthlyChart({ title, subtitle, data, colors, total, barLabel, format, className }: ChartProps & {
  title: string
  subtitle: string
  total: string
  /** kurze Beschriftung über dem Balken */
  barLabel: (n: number) => string
  /** Wert im Tooltip */
  format: (n: number) => string
}) {
  const max = Math.max(1, ...data.map(d => d.total))
  const currentMonth = data[data.length - 1]?.month
  const colorOf = (key: string) => colors[key] ?? 'bg-slate-400'
  // Legende: nur Kunden, die im Zeitraum vorkommen, grösste zuerst.
  const legend = new Map<string, { label: string; value: number }>()
  for (const d of data) for (const p of d.parts) {
    const e = legend.get(p.key) ?? { label: p.label, value: 0 }
    e.value += p.value
    legend.set(p.key, e)
  }
  const legendEntries = Array.from(legend.entries()).sort((a, b) => b[1].value - a[1].value)

  return (
    <Card className={className}>
      <CardContent className="pt-4 sm:pt-6">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{title}</h2>
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          </div>
          <div className="shrink-0 whitespace-nowrap text-right text-sm font-medium tabular-nums">{total}</div>
        </div>
        {/* Feste Höhe, damit die Prozent-Höhen der Balken greifen. */}
        <div className="relative h-48">
          {[0, 0.5, 1].map(f => (
            <div key={f} className="absolute inset-x-0 border-t border-dashed border-border" style={{ bottom: `${f * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-1.5 sm:gap-2">
            {data.map((d, i) => (
              <div
                key={d.month}
                tabIndex={d.total > 0 ? 0 : undefined}
                aria-label={`${d.label}: ${format(d.total)}${d.parts.length > 1 ? ` – ${d.parts.map(p => `${p.label} ${format(p.value)}`).join(', ')}` : ''}`}
                className="group relative flex h-full flex-1 flex-col items-center justify-end rounded-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                {d.total > 0 && (
                  <span className="mb-1 text-[10px] font-medium text-muted-foreground tabular-nums motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-500 sm:text-xs" style={{ animationDelay: `${i * 35}ms` }}>{barLabel(d.total)}</span>
                )}
                <div
                  className="flex w-full max-w-10 flex-col-reverse overflow-hidden rounded-t-md transition-opacity group-hover:opacity-90 motion-safe:animate-wachsen-hoehe"
                  style={{ height: `${(d.total / max) * 85}%`, minHeight: d.total > 0 ? 3 : 0, animationDelay: `${i * 35}ms` }}
                >
                  {d.parts.map(p => (
                    <div key={p.key} className={colorOf(p.key)} style={{ height: `${(p.value / d.total) * 100}%` }} />
                  ))}
                </div>
                {d.total > 0 && (
                  <div
                    role="tooltip"
                    className={cn(
                      'pointer-events-none absolute bottom-full z-10 mb-2 hidden w-max max-w-64 rounded-md border bg-popover p-2.5 text-xs text-popover-foreground shadow-lg group-hover:block group-focus:block',
                      // Am Rand nicht aus der Karte ragen lassen.
                      i < 2 ? 'left-0' : i > data.length - 3 ? 'right-0' : 'left-1/2 -translate-x-1/2',
                    )}
                  >
                    <div className="mb-1.5 font-medium">{d.label}</div>
                    <div className="space-y-1">
                      {d.parts.map(p => (
                        <div key={p.key} className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <span className={cn('h-2 w-2 shrink-0 rounded-full', colorOf(p.key))} />
                            {p.label}
                          </span>
                          <span className="tabular-nums">{format(p.value)}</span>
                        </div>
                      ))}
                    </div>
                    {d.parts.length > 1 && (
                      <div className="mt-1.5 flex justify-between gap-4 border-t pt-1.5 font-medium">
                        <span>Total</span><span className="tabular-nums">{format(d.total)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex gap-1.5 sm:gap-2">
          {data.map(d => (
            <span
              key={d.month}
              className={cn('flex-1 whitespace-nowrap text-center text-[10px] text-muted-foreground sm:text-xs', d.month === currentMonth && 'font-medium text-foreground')}
            >
              {/* Handy: nur der Monat, sonst bricht «Nov 25» um */}
              {d.label.split(' ')[0]}<span className="hidden sm:inline"> {d.label.split(' ')[1]}</span>
            </span>
          ))}
        </div>
        {legendEntries.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t pt-3 text-xs text-muted-foreground">
            {legendEntries.map(([key, e]) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', colorOf(key))} />
                {e.label}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function PaymentsChart({ data, colors, className }: ChartProps) {
  return (
    <MonthlyChart
      title="Zahlungsverlauf"
      subtitle="Bezahlte Rechnungen der letzten 12 Monate, nach Rechnungsdatum"
      data={data}
      total={formatChf(data.reduce((s, d) => s + d.total, 0))}
      colors={colors}
      barLabel={formatZahl}
      format={formatChf}
      className={className}
    />
  )
}

export function HoursChart({ data, colors, className }: ChartProps) {
  return (
    <MonthlyChart
      title="Stundenverlauf"
      subtitle="Gearbeitete Stunden der letzten 12 Monate (verrechnet und offen)"
      data={data}
      total={`${formatStunden(data.reduce((s, d) => s + d.total, 0))} Std.`}
      colors={colors}
      barLabel={formatStunden}
      format={n => `${formatStunden(n)} Std.`}
      className={className}
    />
  )
}

/** Fortschrittsbalken für ein Stundenbudget: amber ab 80 %, rot bei Überschreitung. */
export function BudgetBar({ usage }: { usage: BudgetUsage }) {
  return (
    <div>
      <div className="flex justify-between gap-2 text-xs tabular-nums">
        <span className={cn('text-muted-foreground', usage.stufe === 'knapp' && 'text-amber-400', usage.stufe === 'ueberschritten' && 'text-red-300')}>
          {formatStunden(usage.verbraucht)} von {formatStunden(usage.budget)} Std.
          {usage.stufe === 'ueberschritten' && ` · ${formatStunden(usage.verbraucht - usage.budget)} Std. darüber`}
        </span>
        <span className="text-muted-foreground">{Math.round((usage.verbraucht / usage.budget) * 100)} %</span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar" aria-valuenow={Math.round(usage.anteil * 100)} aria-valuemin={0} aria-valuemax={100}
        aria-label={`Stundenbudget ${usage.label}`}
      >
        <div
          className={cn('h-full origin-left rounded-full bg-primary motion-safe:animate-wachsen-x', usage.stufe === 'knapp' && 'bg-amber-400', usage.stufe === 'ueberschritten' && 'bg-red-400')}
          style={{ width: `${usage.anteil * 100}%` }}
        />
      </div>
    </div>
  )
}
