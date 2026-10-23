import { PiggyBank } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatBetrag, formatChf } from '@/lib/invoices/stats'
import type { ReserveEstimate } from '@/lib/expenses/reserve'

/** Aufschlüsselung der geschätzten Rücklage (Jahresabschluss). */
export default function ReserveCard({ jahr, r }: { jahr: number; r: ReserveEstimate }) {
  const zeilen: [string, string, number][] = [
    ['AHV/IV/EO', r.ahv.satz > 0 ? `${r.ahv.satz.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')} % vom Gewinn` : r.ahv.hinweis, r.ahv.beitrag],
    ['Verwaltungskosten', 'höchstens 5 % der Beiträge', r.ahv.verwaltungskosten],
    ['Einkommenssteuer', `${r.grenzsteuersatz} % Grenzsteuersatz auf den Gewinn nach AHV`, r.steuer],
  ]
  return (
    <Card>
      <CardContent className="pt-4 sm:pt-6">
        <div className="flex items-start gap-3">
          <PiggyBank className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Rücklage für AHV und Steuern {jahr}</h2>
            <p className="text-xs text-muted-foreground">
              So viel solltest du ungefähr zur Seite legen. Schätzung mit den AHV-Ansätzen 2026 und deinem Grenzsteuersatz aus den <a href="/admin/einstellungen" className="underline underline-offset-2 hover:text-foreground">Einstellungen</a>; keine Steuerberatung.
            </p>
            <dl className="mt-4 divide-y text-sm">
              {zeilen.map(([label, hinweis, betrag]) => (
                <div key={label} className="flex flex-wrap items-baseline gap-x-4 py-2">
                  <dt className="min-w-0 flex-1">
                    {label}
                    <span className="block text-xs text-muted-foreground">{hinweis}</span>
                  </dt>
                  <dd className="whitespace-nowrap tabular-nums">{formatBetrag(betrag, { tabelle: true })}</dd>
                </div>
              ))}
              <div className="flex items-baseline gap-4 py-2 font-medium">
                <dt className="flex-1">Rücklage total</dt>
                <dd className="whitespace-nowrap tabular-nums">{formatChf(r.total)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
