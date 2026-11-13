import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { formatBetrag, formatChf, formatStunden } from '@/lib/invoices/stats'
import { formatDatum } from '@/lib/utils'
import type { HoursGroup, HoursRow } from '@/lib/timeEntries/hoursOverview'
import Aufklapper from './Aufklapper'

type Rechnung = NonNullable<HoursRow['rechnung']>

/**
 * Zugeklappte Card mit offenen und verrechneten Stunden (Kundenseite). Im Kundenkonto des Admins
 * stehen die offenen in einer eigenen Card (OpenHoursCard), dort mit `ohneOffen`.
 */
export default function HoursCard({ offen, verrechnet, rechnungLink, ohneOffen = false }: {
  offen: HoursGroup
  verrechnet: HoursGroup
  /** Rechnungsnummer als Link oder Vorschau-Knopf */
  rechnungLink: (rechnung: Rechnung) => ReactNode
  ohneOffen?: boolean
}) {
  if (ohneOffen ? verrechnet.rows.length === 0 : offen.rows.length === 0 && verrechnet.rows.length === 0) return null
  const zusatz = ohneOffen
    ? `(${formatStunden(verrechnet.stunden)} Std. · ${formatChf(verrechnet.betrag)})`
    : `(${formatStunden(verrechnet.stunden)} Std. verrechnet · ${formatStunden(offen.stunden)} Std. offen)`
  return (
    <Card>
      <Aufklapper titel={ohneOffen ? 'Verrechnete Stunden' : 'Stunden'} zusatz={zusatz}>
        <CardContent className="space-y-8 pt-2 sm:pt-2">
          {ohneOffen ? (
            <HoursRowsTable gruppe={verrechnet} leer="Noch keine verrechneten Stunden." rechnungLink={rechnungLink} />
          ) : (
            <>
              <HoursTable titel="Nicht verrechnet" gruppe={offen} leer="Keine offenen Stunden." />
              <HoursTable titel="Verrechnet" gruppe={verrechnet} leer="Noch keine verrechneten Stunden." rechnungLink={rechnungLink} />
            </>
          )}
        </CardContent>
      </Aufklapper>
    </Card>
  )
}

/** Offene Zeiteinträge eines Kunden, immer aufgeklappt (Kundenkonto im Admin). */
export function OpenHoursCard({ gruppe, link }: { gruppe: HoursGroup; link: string }) {
  if (gruppe.rows.length === 0) return null
  return (
    <Card>
      <CardContent className="pt-4 sm:pt-6">
        <div className="karte-titel -mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
          <h2 className="text-sm font-medium">
            Offene Zeiteinträge{' '}
            <span className="font-normal tabular-nums text-muted-foreground">({formatStunden(gruppe.stunden)} Std. · {formatChf(gruppe.betrag)})</span>
          </h2>
          <a href={link} className="text-xs text-muted-foreground hover:text-foreground hover:underline">In der Zeiterfassung →</a>
        </div>
        <HoursRowsTable gruppe={gruppe} leer="Keine offenen Stunden." />
      </CardContent>
    </Card>
  )
}

function HoursTable({ titel, gruppe, leer, rechnungLink }: {
  titel: string
  gruppe: HoursGroup
  leer: string
  rechnungLink?: (rechnung: Rechnung) => ReactNode
}) {
  return (
    // tabelle-gruppe: Untertitel klebt ab Desktop mit dem Tabellenkopf unter dem Seitenkopf (globals.css)
    <section className="tabelle-gruppe">
      <h3 className="flex flex-wrap items-baseline justify-between gap-x-4 py-2 text-sm font-medium">
        {titel}
        <span className="font-normal tabular-nums text-muted-foreground">
          {formatStunden(gruppe.stunden)} Std. · {formatChf(gruppe.betrag)}
        </span>
      </h3>
      <HoursRowsTable gruppe={gruppe} leer={leer} rechnungLink={rechnungLink} />
    </section>
  )
}

function HoursRowsTable({ gruppe, leer, rechnungLink }: {
  gruppe: HoursGroup
  leer: string
  rechnungLink?: (rechnung: Rechnung) => ReactNode
}) {
  const spalten = rechnungLink ? 5 : 4
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="hidden sm:table-cell">Datum</TableHead>
          <TableHead>Beschreibung</TableHead>
          {rechnungLink && <TableHead className="hidden md:table-cell">Rechnung</TableHead>}
          <TableHead className="text-right">Std.</TableHead>
          <TableHead className="text-right">Betrag</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {gruppe.rows.map(r => (
          <TableRow key={r.id}>
            <TableCell className="hidden whitespace-nowrap tabular-nums sm:table-cell">{formatDatum(r.datum)}</TableCell>
            <TableCell>
              <div className="whitespace-pre-line wrap-anywhere">{r.beschreibung}</div>
              <div className="mt-1 flex flex-wrap gap-x-2 text-xs tabular-nums text-muted-foreground sm:hidden">
                {formatDatum(r.datum)}
              </div>
              {rechnungLink && r.rechnung && (
                <div className="mt-1 text-xs md:hidden"><RechnungRef rechnung={r.rechnung} link={rechnungLink} /></div>
              )}
            </TableCell>
            {rechnungLink && (
              <TableCell className="hidden md:table-cell">{r.rechnung ? <RechnungRef rechnung={r.rechnung} link={rechnungLink} /> : '–'}</TableCell>
            )}
            <TableCell className="text-right tabular-nums align-top sm:align-middle">{formatStunden(r.stunden)}</TableCell>
            <TableCell className="whitespace-nowrap text-right tabular-nums align-top sm:align-middle">{formatBetrag(r.betrag, { tabelle: true })}</TableCell>
          </TableRow>
        ))}
        {gruppe.rows.length === 0 && (
          <TableRow><TableCell colSpan={spalten} className="py-6 text-center text-muted-foreground">{leer}</TableCell></TableRow>
        )}
      </TableBody>
    </Table>
  )
}

/** Rechnungsnummer; Entwürfe (nur im Admin geladen) mit Hinweis. */
function RechnungRef({ rechnung, link }: { rechnung: Rechnung; link: (rechnung: Rechnung) => ReactNode }) {
  return (
    <>
      {link(rechnung)}
      {rechnung.status === 'entwurf' && <span className="ml-1.5 text-muted-foreground">(Entwurf)</span>}
    </>
  )
}
