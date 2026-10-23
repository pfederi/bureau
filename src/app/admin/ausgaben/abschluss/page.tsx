import { ArrowLeft, Download, FileText, FolderArchive, Info } from 'lucide-react'
import { loadYearReport } from '@/lib/db/yearReport'
import { ahvGrenze } from '@/lib/expenses/report'
import { estimateReserve } from '@/lib/expenses/reserve'
import { getSettings } from '@/lib/db/settings'
import ReserveCard from '../../ReserveCard'
import { categoryLabel } from '@/lib/expenses/categories'
import { formatChf } from '@/lib/invoices/stats'
import { cn, formatDatum } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatCard, ChfValue } from '../../DashboardWidgets'
import YearSelect from './YearSelect'
import StickyHeader from '../../StickyHeader'

export const metadata = { title: 'Jahresabschluss' }

function Delta({ jetzt, vorher, jahr }: { jetzt: number; vorher: number; jahr: number }) {
  const diff = jetzt - vorher
  if (vorher === 0 && jetzt === 0) return <>Keine Werte</>
  return <>{diff >= 0 ? '+' : '−'}{formatChf(Math.abs(diff))} gegenüber {jahr - 1}</>
}

export default async function AbschlussPage(props: { searchParams: Promise<{ jahr?: string }> }) {
  const searchParams = await props.searchParams
  const parsed = Number(searchParams.jahr)
  const jahr = Number.isInteger(parsed) && parsed > 2000 ? parsed : new Date().getFullYear()
  const [{ report: r, vorjahr: v }, settings] = await Promise.all([loadYearReport(jahr), getSettings().catch(() => null)])
  const ruecklage = estimateReserve(r.gewinn, jahr, Number(settings?.grenzsteuersatz ?? 25))
  const grenze = ahvGrenze(jahr)

  return (
    <div className="space-y-6">
      <StickyHeader>
        <div>
          <a href={`/admin/ausgaben?jahr=${jahr}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-1" />Ausgaben
          </a>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Jahresabschluss {jahr}</h1>
              <p className="text-sm text-muted-foreground">Selbständige Erwerbstätigkeit im Nebenerwerb, Einnahmen nach Zahlungseingang – Grundlage für das Hilfsblatt A.</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <YearSelect jahr={jahr} />
              <Button asChild variant="outline">
                <a href={`/api/admin/jahresabschluss/${jahr}/csv`}><Download className="h-4 w-4 mr-1.5" />CSV</a>
              </Button>
              <Button asChild variant="outline">
                <a href={`/api/admin/jahresabschluss/${jahr}/paket`} title="Jahresabschluss, Belege und Rechnungen als ZIP">
                  <FolderArchive className="h-4 w-4 mr-1.5" />Steuerpaket
                </a>
              </Button>
              <Button asChild>
                <a href={`/api/admin/jahresabschluss/${jahr}/pdf`}><FileText className="h-4 w-4 mr-1.5" />PDF</a>
              </Button>
            </div>
          </div>
        </div>
      </StickyHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
        <StatCard label="Einnahmen" value={<ChfValue amount={r.einnahmenTotal} />} hint={<Delta jetzt={r.einnahmenTotal} vorher={v.einnahmenTotal} jahr={jahr} />} />
        <StatCard label="Ausgaben" value={<ChfValue amount={r.ausgabenTotal} />} hint={<Delta jetzt={r.ausgabenTotal} vorher={v.ausgabenTotal} jahr={jahr} />} />
        <StatCard label="Gewinn" value={<ChfValue amount={r.gewinn} />} hint={<Delta jetzt={r.gewinn} vorher={v.gewinn} jahr={jahr} />} />
      </div>

      <Card>
        <CardContent className="flex gap-3 pt-4 sm:pt-6 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <div className="space-y-1">
            <p className={cn(r.gewinn > grenze && 'font-medium text-amber-400')}>
              {r.gewinn > grenze
                ? `AHV: Der Gewinn liegt über ${formatChf(grenze)}. Auf diesem Nebenerwerb sind AHV-Beiträge geschuldet – Anmeldung bei der Ausgleichskasse prüfen.`
                : `AHV: Bis ${formatChf(grenze)} Gewinn im Jahr werden Beiträge auf dem Nebenerwerb nur auf Verlangen erhoben.`}
            </p>
            <p className="text-muted-foreground">Allgemeine Einordnung, keine Steuerberatung. Belege 10 Jahre aufbewahren.</p>
          </div>
        </CardContent>
      </Card>

      <ReserveCard jahr={jahr} r={ruecklage} />

      {/* min-w-0: Rasterzellen dürfen schmaler als ihre Tabelle werden (Tabelle scrollt dann intern) */}
      <div className="grid gap-4 lg:grid-cols-2 *:min-w-0">
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <h2 className="mb-4 text-sm font-medium">Ausgaben pro Kategorie</h2>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Kategorie</TableHead><TableHead className="hidden text-right sm:table-cell">Anzahl</TableHead><TableHead className="text-right">{jahr}</TableHead><TableHead className="text-right">{jahr - 1}</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {r.proKategorie.map(k => (
                  <TableRow key={k.kategorie}>
                    <TableCell>
                      {k.label}
                      <span className="block text-xs text-muted-foreground sm:hidden">{k.anzahl} {k.anzahl === 1 ? 'Beleg' : 'Belege'}</span>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{k.anzahl}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{formatChf(k.betrag, { tabelle: true })}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">{formatChf(v.proKategorie.find(x => x.kategorie === k.kategorie)?.betrag ?? 0, { tabelle: true })}</TableCell>
                  </TableRow>
                ))}
                {r.proKategorie.length === 0 && <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Noch keine Ausgaben erfasst.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <h2 className="mb-4 text-sm font-medium">Einnahmen ({r.einnahmen.length})</h2>
            <Table>
              <TableHeader>
                <TableRow><TableHead className="hidden sm:table-cell">Bezahlt</TableHead><TableHead>Rechnung</TableHead><TableHead className="hidden sm:table-cell">Art</TableHead><TableHead className="text-right">Betrag</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {r.einnahmen.map(e => (
                  <TableRow key={e.rechnungsnummer}>
                    <TableCell className="hidden tabular-nums sm:table-cell">{formatDatum(e.datum)}</TableCell>
                    <TableCell>
                      <span className="block wrap-anywhere">{e.rechnungsnummer}</span>
                      <span className="block text-xs text-muted-foreground">{e.kunde}<span className="sm:hidden"> · bezahlt {formatDatum(e.datum)} · {e.art}</span></span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{e.art}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{formatChf(e.betrag, { tabelle: true })}</TableCell>
                  </TableRow>
                ))}
                {r.einnahmen.length === 0 && <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Keine bezahlten Rechnungen in diesem Jahr.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {r.offenAmJahresende.length > 0 && (
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <h2 className="text-sm font-medium">Offen am 31.12.{jahr}</h2>
            <p className="mb-4 text-xs text-muted-foreground">Verrechnet, aber erst später bezahlt. Diese Beträge zählen im Jahr des Zahlungseingangs.</p>
            <Table>
              <TableBody>
                {r.offenAmJahresende.map(o => (
                  <TableRow key={o.rechnungsnummer}>
                    <TableCell className="hidden tabular-nums sm:table-cell">{formatDatum(o.rechnungsdatum)}</TableCell>
                    <TableCell>
                      <span className="block wrap-anywhere">{o.rechnungsnummer}</span>
                      <span className="block text-xs text-muted-foreground sm:hidden">{o.kunde} · {formatDatum(o.rechnungsdatum)}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{o.kunde}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{formatChf(o.betrag, { tabelle: true })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
