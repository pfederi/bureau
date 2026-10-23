import { Paperclip, FileBarChart } from 'lucide-react'
import { listExpenses } from '@/lib/db/expenses'
import { EXPENSE_CATEGORIES, categoryLabel } from '@/lib/expenses/categories'
import { formatChf, formatWaehrung } from '@/lib/invoices/stats'
import { formatDatum } from '@/lib/utils'
import type { ExpenseCategory } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { NewExpenseButton } from './ExpenseDialog'
import ExpenseActions from './ExpenseActions'
import ExpenseFilterBar from './ExpenseFilterBar'
import RecurringHints from './RecurringHints'
import { findMissingRecurring } from '@/lib/expenses/recurring'
import { getSettings } from '@/lib/db/settings'
import StickyHeader from '../StickyHeader'

export const metadata = { title: 'Ausgaben' }

export default async function AusgabenPage(props: { searchParams: Promise<{ jahr?: string; kategorie?: string }> }) {
  const searchParams = await props.searchParams
  const jahr = searchParams.jahr || String(new Date().getFullYear())
  const kategorie = EXPENSE_CATEGORIES.find(c => c.value === searchParams.kategorie)?.value as ExpenseCategory | undefined
  const [expenses, alle, settings] = await Promise.all([
    listExpenses({ jahr: jahr === 'alle' ? undefined : jahr, kategorie }),
    listExpenses(),
    getSettings().catch(() => null),
  ])
  const fehlend = findMissingRecurring(alle, new Date(), settings?.belege_ausgeblendet ?? [])
  const total = expenses.reduce((s, e) => s + Number(e.betrag), 0)
  const today = new Date().toISOString().slice(0, 10)
  const abschlussJahr = jahr === 'alle' ? String(new Date().getFullYear()) : jahr

  return (
    <div className="space-y-6">
      <StickyHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ausgaben</h1>
            <p className="text-sm text-muted-foreground">Geschäftliche Kosten mit Beleg – Grundlage für den Jahresabschluss.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a href={`/admin/ausgaben/abschluss?jahr=${abschlussJahr}`}><FileBarChart className="h-4 w-4 mr-1.5" />Jahresabschluss</a>
            </Button>
            <NewExpenseButton today={today} />
          </div>
        </div>
        <ExpenseFilterBar jahr={jahr} kategorie={kategorie ?? ''} />
      </StickyHeader>
      <RecurringHints hints={fehlend} today={today} />
      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden md:table-cell">Datum</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead className="hidden lg:table-cell">Kategorie</TableHead>
                <TableHead className="hidden sm:table-cell">Beleg</TableHead>
                <TableHead className="text-right">Betrag</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="hidden tabular-nums md:table-cell">{formatDatum(e.datum)}</TableCell>
                  <TableCell>
                    <span className="block">{e.beschreibung}</span>
                    {e.lieferant && <span className="block text-xs text-muted-foreground">{e.lieferant}</span>}
                    {/* Handy: Datum und Kategorie als zusätzliche Zeile */}
                    <span className="block text-xs text-muted-foreground lg:hidden">
                      <span className="md:hidden">{formatDatum(e.datum)} · </span>{categoryLabel(e.kategorie)}
                      {e.beleg_path && <span className="sm:hidden"> · <a href={`/api/admin/expenses/${e.id}/beleg`} target="_blank" rel="noopener noreferrer" className="-my-1 inline-flex min-h-6 items-center gap-1 rounded-sm px-1 py-1 text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"><Paperclip className="h-3 w-3" aria-hidden />Beleg</a></span>}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell"><Badge variant="secondary" className="whitespace-nowrap">{categoryLabel(e.kategorie)}</Badge></TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {e.beleg_path ? (
                      <a href={`/api/admin/expenses/${e.id}/beleg`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                        <Paperclip className="h-4 w-4" />Öffnen
                      </a>
                    ) : <span className="text-sm text-muted-foreground">fehlt</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="block whitespace-nowrap">{formatChf(Number(e.betrag), { tabelle: true })}</span>
                    {e.waehrung !== 'CHF' && e.betrag_original !== null && (
                      <span className="block whitespace-nowrap text-xs text-muted-foreground">{formatWaehrung(Number(e.betrag_original), e.waehrung, { tabelle: true })}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right"><ExpenseActions expense={e} today={today} /></TableCell>
                </TableRow>
              ))}
              {expenses.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Keine Ausgaben für diesen Filter.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {expenses.length > 0 && (
            <div className="mt-4 flex justify-end gap-6 border-t pt-4 text-sm font-medium tabular-nums">
              <span>Total ({expenses.length} {expenses.length === 1 ? 'Ausgabe' : 'Ausgaben'})</span>
              <span>{formatChf(total, { tabelle: true })}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
