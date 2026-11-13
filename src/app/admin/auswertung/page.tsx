import Link from 'next/link'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { listInvoices } from '@/lib/db/invoices'
import { listTimeEntries } from '@/lib/db/timeEntries'
import { listCredits } from '@/modules/material'
import { coveredAmounts } from '@/lib/invoices/account'
import { dominanterKunde, kundenAuswertung, sortiereZeilen, SORT_SPALTEN, type KundenZeile, type SortSpalte } from '@/lib/invoices/customerReport'
import { formatBetrag, formatChf, formatStunden } from '@/lib/invoices/stats'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from '@/components/ui/table'
import StickyHeader from '../StickyHeader'
import ReportYearFilter from './ReportYearFilter'

export const metadata = { title: 'Auswertung' }

const SPAET_AB = 30

type Params = { jahr?: string; sort?: string; richtung?: string }

function Zahlung({ tage }: { tage: number | null }) {
  if (tage === null) return <>–</>
  const text = tage === 1 ? '1 Tag' : `${tage} Tage`
  return tage > SPAET_AB ? <span className="text-amber-400">{text} · spät</span> : <>{text}</>
}

function Anteil({ z }: { z: Pick<KundenZeile, 'anteil'> }) {
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span aria-hidden className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted lg:block">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${z.anteil}%` }} />
      </span>
      {z.anteil}{'\u00A0'}%
    </span>
  )
}

export default async function AuswertungPage(props: { searchParams: Promise<Params> }) {
  const sp = await props.searchParams
  const heute = new Date().getFullYear()
  const jahrNum = sp.jahr === 'alle' ? null : /^\d{4}$/.test(sp.jahr ?? '') ? Number(sp.jahr) : heute
  const jahrParam = jahrNum === null ? 'alle' : String(jahrNum)
  const spalte: SortSpalte = SORT_SPALTEN.includes(sp.sort as SortSpalte) ? (sp.sort as SortSpalte) : 'umsatz'
  const standardRichtung = spalte === 'kunde' ? 'auf' : 'ab'
  const richtung = sp.richtung === 'auf' || sp.richtung === 'ab' ? sp.richtung : standardRichtung

  const [invoices, entries, credits] = await Promise.all([
    listInvoices(), listTimeEntries({ status: 'verrechnet' }), listCredits(),
  ])
  const auswertung = kundenAuswertung(invoices, entries, jahrNum, coveredAmounts(invoices, credits))
  const zeilen = sortiereZeilen(auswertung.zeilen, { spalte, richtung })
  const dominant = dominanterKunde(auswertung)
  const zeitraum = jahrNum === null ? 'gesamten Umsatzes' : `Umsatzes ${jahrNum}`

  const href = (s: SortSpalte) => {
    const r = s === spalte ? (richtung === 'ab' ? 'auf' : 'ab') : (s === 'kunde' ? 'auf' : 'ab')
    return `/admin/auswertung?jahr=${jahrParam}&sort=${s}&richtung=${r}`
  }
  const Kopf = ({ s, children, className }: { s: SortSpalte; children: React.ReactNode; className?: string }) => (
    <TableHead className={className} aria-sort={s === spalte ? (richtung === 'auf' ? 'ascending' : 'descending') : undefined}>
      <Link href={href(s)} className="inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
        {children}
        <span className="sr-only">, sortieren</span>
        {s === spalte && (richtung === 'auf' ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden />)}
      </Link>
    </TableHead>
  )

  return (
    <div className="space-y-6">
      <StickyHeader>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Auswertung</h1>
          <p className="text-sm text-muted-foreground">Umsatz, effektiver Ansatz und Zahlungsdauer pro Kunde.</p>
        </div>
        <ReportYearFilter jahr={jahrParam} />
      </StickyHeader>

      {dominant && (
        <Card>
          <CardContent className="pt-4 text-sm sm:pt-6">
            <strong className="font-medium">{dominant.kunde}</strong> macht {dominant.anteil}{'\u00A0'}% deines {zeitraum} aus.
          </CardContent>
        </Card>
      )}

      {zeilen.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {jahrNum === null ? 'Noch keine versendeten oder bezahlten Rechnungen.' : `Im Jahr ${jahrNum} gibt es noch keine versendeten oder bezahlten Rechnungen.`}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <Kopf s="kunde">Kunde</Kopf>
                  <Kopf s="umsatz" className="text-right">Umsatz</Kopf>
                  <Kopf s="anteil" className="text-right">Anteil</Kopf>
                  <Kopf s="offen" className="hidden text-right md:table-cell">davon offen</Kopf>
                  <Kopf s="stunden" className="hidden text-right md:table-cell">Std.</Kopf>
                  <Kopf s="ansatz" className="hidden text-right md:table-cell">Ansatz eff.</Kopf>
                  <Kopf s="zahlung" className="hidden text-right md:table-cell">Ø Zahlung</Kopf>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zeilen.map(z => (
                  <TableRow key={z.customerId}>
                    <TableCell>
                      <Link href={`/admin/kunden/${z.customerId}/konto`} className="font-medium hover:underline">{z.kunde}</Link>
                      <div className="mt-1 text-xs tabular-nums text-muted-foreground md:hidden">
                        offen {formatBetrag(z.offen)} · {formatStunden(z.stunden)} Std. · Ansatz {z.ansatzEffektiv !== null ? formatBetrag(z.ansatzEffektiv) : '–'} · Zahlung <Zahlung tage={z.zahlungTage} />
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums align-top md:align-middle">{formatBetrag(z.umsatz, { tabelle: true })}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums align-top md:align-middle"><Anteil z={z} /></TableCell>
                    <TableCell className="hidden whitespace-nowrap text-right tabular-nums md:table-cell">{formatBetrag(z.offen, { tabelle: true })}</TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{formatStunden(z.stunden)}</TableCell>
                    <TableCell className="hidden whitespace-nowrap text-right tabular-nums md:table-cell">{z.ansatzEffektiv !== null ? formatBetrag(z.ansatzEffektiv, { tabelle: true }) : '–'}</TableCell>
                    <TableCell className="hidden whitespace-nowrap text-right tabular-nums md:table-cell"><Zahlung tage={z.zahlungTage} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-medium">
                    Total
                    <div className="mt-1 text-xs font-normal tabular-nums text-muted-foreground md:hidden">
                      offen {formatBetrag(auswertung.total.offen)} · {formatStunden(auswertung.total.stunden)} Std. · Ansatz {auswertung.total.ansatzEffektiv !== null ? formatBetrag(auswertung.total.ansatzEffektiv) : '–'} · Zahlung <Zahlung tage={auswertung.total.zahlungTage} />
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">{formatChf(auswertung.total.umsatz, { tabelle: true })}</TableCell>
                  <TableCell className="text-right tabular-nums align-top md:align-middle">{auswertung.total.anteil}{'\u00A0'}%</TableCell>
                  <TableCell className="hidden whitespace-nowrap text-right tabular-nums md:table-cell">{formatChf(auswertung.total.offen, { tabelle: true })}</TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{formatStunden(auswertung.total.stunden)}</TableCell>
                  <TableCell className="hidden whitespace-nowrap text-right tabular-nums md:table-cell">{auswertung.total.ansatzEffektiv !== null ? formatBetrag(auswertung.total.ansatzEffektiv, { tabelle: true }) : '–'}</TableCell>
                  <TableCell className="hidden whitespace-nowrap text-right tabular-nums md:table-cell"><Zahlung tage={auswertung.total.zahlungTage} /></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
