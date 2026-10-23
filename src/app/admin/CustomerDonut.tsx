import { Card, CardContent } from '@/components/ui/card'
import { formatBetrag, formatChf, type CustomerShare } from '@/lib/invoices/stats'
import { colorHex } from './DashboardWidgets'

const R = 40
const UMFANG = 2 * Math.PI * R

/** Anteil der Kunden am Gesamtverdienst (bezahlte Rechnungen aller Jahre) als Donut mit Legende. */
export default function CustomerDonut({ shares, colors, className }: {
  shares: CustomerShare[]
  colors: Record<string, string>
  className?: string
}) {
  const total = shares.reduce((s, x) => s + x.betrag, 0)
  let offset = 0
  return (
    <Card className={className}>
      <CardContent className="pt-4 sm:pt-6">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">Kunden</h2>
            <div className="text-xs text-muted-foreground">Anteil am Gesamtverdienst, alle Jahre</div>
          </div>
        </div>
        {shares.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine bezahlten Rechnungen.</p>
        ) : (
          <div className="flex flex-col items-center gap-5">
            <div className="relative h-36 w-36 shrink-0" aria-hidden>
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle cx="50" cy="50" r={R} fill="none" strokeWidth="14" className="stroke-muted" />
                {/* Maske «zeichnet» die Segmente im Kreis auf (ohne Animation ist sie voll sichtbar) */}
                <mask id="donut-aufbau">
                  <circle
                    cx="50" cy="50" r={R} fill="none" strokeWidth="16" stroke="white"
                    strokeDasharray={UMFANG} className="motion-safe:animate-donut-zeichnen" style={{ ['--umfang' as string]: UMFANG }}
                  />
                </mask>
                <g mask="url(#donut-aufbau)">
                {shares.map(s => {
                  const len = s.anteil * UMFANG
                  // kleine Lücke zwischen den Segmenten, ausser bei nur einem Kunden
                  const gap = shares.length > 1 ? Math.min(1.2, len / 3) : 0
                  const el = (
                    <circle
                      key={s.customerId}
                      cx="50" cy="50" r={R} fill="none" strokeWidth="14"
                      stroke={colorHex(colors[s.customerId])}
                      strokeDasharray={`${Math.max(0, len - gap)} ${UMFANG}`}
                      strokeDashoffset={-offset}
                    />
                  )
                  offset += len
                  return el
                })}
                </g>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[11px] text-muted-foreground">Total</span>
                <span className="text-xs font-medium tabular-nums">{formatBetrag(total)}</span>
              </div>
            </div>
            <ul className="w-full min-w-0 space-y-2 text-sm">
              {shares.map(s => (
                <li key={s.customerId}>
                  <a href={`/admin/kunden/${s.customerId}/konto`} className="flex items-baseline gap-2 rounded-sm hover:text-blue-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="h-2 w-2 shrink-0 self-center rounded-full" style={{ backgroundColor: colorHex(colors[s.customerId]) }} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{s.kunde}</span>
                    <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground tabular-nums">{Math.round(s.anteil * 100)} %</span>
                    <span className="w-24 shrink-0 whitespace-nowrap text-right tabular-nums" title={formatChf(s.betrag)}>{formatBetrag(s.betrag, { tabelle: true })}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
