'use client'
import { useState } from 'react'
import type { Customer, TimeEntry } from '@/lib/types'
import { createInvoiceAction, updateInvoiceAction } from './actions'
import { computeItemTotal, computeDiscountedTotals } from '@/lib/invoices/calc'
import { hasHosting, hostingItemForYear, hostingYears } from '@/lib/invoices/hosting'
import { formatChf, formatBetrag } from '@/lib/invoices/stats'
import type { HostingBilled } from '@/lib/db/invoices'
import { cn, formatDatum } from '@/lib/utils'
import { edition } from '@/edition'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Plus, Save, Clock, Server, AlertTriangle } from 'lucide-react'

// timeEntryId/originalRate sind nur bei aus der Zeiterfassung übernommenen Positionen gesetzt,
// hostingJahr nur bei der per «Hosting übernehmen» erzeugten Position.
type Row = { bezeichnung: string; menge: number; einheit: string; einzelpreis: number; timeEntryId?: string; originalRate?: number; hostingJahr?: number }

type InitialInvoice = {
  invoiceId: string
  customerId: string
  typ: 'pauschal' | 'stunden'
  rechnungsdatum: string
  leistungsdatum: string
  notiz: string
  rabattProzent: number
  hostingJahr: number | null
  verrechnungMaterial: boolean
  rows: Row[]
}

const EINHEITEN = ['Stück', 'Std.', 'Pauschal', 'Tag', 'km', 'Monat', 'Jahr']

// Hosting wird oft im Voraus verrechnet, darum auch das nächste Jahr anbieten.
const CURRENT_YEAR = new Date().getFullYear()
const HOSTING_YEARS = hostingYears()

export default function InvoiceForm({ customers, mwstHinweis, today, hostingBilled, initial, defaultCustomerId }: {
  customers: Customer[]; mwstHinweis: string; today: string; hostingBilled: HostingBilled[]; initial?: InitialInvoice
  /** Vorauswahl bei neuer Rechnung, z. B. aus dem Kundenkonto */
  defaultCustomerId?: string
}) {
  const isEdit = !!initial
  const [typ, setTyp] = useState<'pauschal' | 'stunden'>(initial?.typ ?? 'pauschal')
  const [customerId, setCustomerId] = useState(initial?.customerId ?? (customers.some(c => c.id === defaultCustomerId) ? defaultCustomerId! : ''))
  const [rows, setRows] = useState<Row[]>(initial?.rows ?? [{ bezeichnung: '', menge: 1, einheit: 'Stück', einzelpreis: 0 }])
  const [chosen, setChosen] = useState<string[]>([])
  const [rabattProzent, setRabattProzent] = useState(initial?.rabattProzent ?? 0)
  const zwischensumme = rows.reduce((s, r) => s + computeItemTotal(r.menge, r.einzelpreis), 0)
  const { rabatt, total } = computeDiscountedTotals(zwischensumme, rabattProzent)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [openEntries, setOpenEntries] = useState<TimeEntry[]>([])
  const [pickedIds, setPickedIds] = useState<string[]>([])
  const [rateOverrides, setRateOverrides] = useState<Record<string, number>>({})

  const [hostingJahr, setHostingJahr] = useState<number | null>(initial?.hostingJahr ?? null)
  const [hostingOpen, setHostingOpen] = useState(false)
  const [hostingYear, setHostingYear] = useState(String(CURRENT_YEAR))

  const selectedCustomer = customers.find(c => c.id === customerId)
  const selectedCustomerName = selectedCustomer?.firma_oder_name
  const hostingPreview = selectedCustomer ? hostingItemForYear(selectedCustomer, Number(hostingYear)) : null
  const hostingAlreadyBilled = hostingBilled.filter(b =>
    b.customer_id === customerId && b.hosting_jahr === Number(hostingYear) && b.invoice_id !== initial?.invoiceId)

  const availableEntries = openEntries.filter(e => !chosen.includes(e.id))
  const pickedSum = availableEntries
    .filter(e => pickedIds.includes(e.id))
    .reduce((s, e) => s + computeItemTotal(e.stunden, rateOverrides[e.id] ?? e.stundensatz), 0)

  async function openPicker() {
    if (!customerId) return
    const res = await fetch(`/api/time-entries?customer=${customerId}`)
    const data: TimeEntry[] = await res.json()
    setOpenEntries(data)
    setPickedIds(data.filter(e => !chosen.includes(e.id)).map(e => e.id))
    setRateOverrides({})
    setPickerOpen(true)
  }

  function addPicked() {
    const picked = availableEntries.filter(e => pickedIds.includes(e.id))
    if (picked.length === 0) return
    const newRows: Row[] = picked.map(e => ({
      bezeichnung: `${formatDatum(e.datum)}: ${e.beschreibung}`,
      menge: e.stunden,
      einheit: 'Std.',
      einzelpreis: rateOverrides[e.id] ?? e.stundensatz,
      timeEntryId: e.id,
      originalRate: e.stundensatz,
    }))
    setRows(prev => [...prev.filter(r => r.bezeichnung !== '' || r.einzelpreis !== 0 || r.timeEntryId), ...newRows])
    setChosen(prev => [...prev, ...picked.map(e => e.id)])
    setPickerOpen(false)
  }

  function addHosting() {
    if (!hostingPreview) return
    const jahr = Number(hostingYear)
    setRows(prev => [
      ...prev.filter(r => !r.hostingJahr && (r.bezeichnung !== '' || r.einzelpreis !== 0 || r.timeEntryId)),
      { ...hostingPreview, hostingJahr: jahr },
    ])
    setHostingJahr(jahr)
    setHostingOpen(false)
  }

  function removeRow(i: number) {
    const r = rows[i]
    setRows(rows.filter((_, j) => j !== i))
    if (r.timeEntryId) setChosen(chosen.filter(id => id !== r.timeEntryId))
    if (r.hostingJahr) setHostingJahr(null)
  }

  const action = isEdit ? updateInvoiceAction.bind(null, initial.invoiceId) : createInvoiceAction

  return (
    <Card>
      <CardContent className="pt-4 sm:pt-6">
        <form action={action} className="space-y-4">
          <input type="hidden" name="items" value={JSON.stringify(rows)} />
          {!isEdit && <input type="hidden" name="timeEntryIds" value={JSON.stringify(chosen)} />}
          <input type="hidden" name="typ" value={typ} />
          <input type="hidden" name="hosting_jahr" value={hostingJahr ?? ''} />
          <input type="hidden" name="mwst_hinweis" value={mwstHinweis} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label htmlFor="typ">Typ</Label>
              <Select value={typ} onValueChange={(v) => setTyp(v as 'pauschal' | 'stunden')}>
                <SelectTrigger id="typ"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pauschal">Pauschal</SelectItem>
                  <SelectItem value="stunden">Nach Stundenaufwand</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="kunde">Kunde</Label>
              <Select name="customer_id" required value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger id="kunde"><SelectValue placeholder="wählen…" /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.firma_oder_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label htmlFor="rechnungsdatum">Rechnungsdatum</Label><Input id="rechnungsdatum" name="rechnungsdatum" type="date" defaultValue={initial?.rechnungsdatum ?? today} required /></div>
            <div className="space-y-1.5"><Label htmlFor="leistungsdatum">Leistungsdatum</Label><Input id="leistungsdatum" name="leistungsdatum" placeholder="z. B. 2024" defaultValue={initial?.leistungsdatum ?? ''} /></div>
          </div>

          <div className="space-y-2">
            <Label>Positionen</Label>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-12 items-start gap-2 border-b pb-3 last:border-0 sm:border-0 sm:pb-0">
                <div className="col-span-12 relative sm:col-span-6">
                  <Input
                    aria-label={`Bezeichnung Position ${i + 1}`}
                    className={cn(r.timeEntryId && 'pl-8')}
                    placeholder="Bezeichnung"
                    value={r.bezeichnung}
                    onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, bezeichnung: e.target.value } : x))}
                  />
                  {r.timeEntryId && (
                    <Clock className="h-3.5 w-3.5 text-primary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-label="Aus Zeiterfassung" />
                  )}
                </div>
                <DecimalInput aria-label={`Menge Position ${i + 1}`} placeholder="Menge" className="col-span-3 sm:col-span-1" value={r.menge} onValueChange={n => setRows(rows.map((x, j) => j === i ? { ...x, menge: n } : x))} />
                <div className="col-span-4 sm:col-span-2">
                  <Select value={r.einheit} onValueChange={v => setRows(rows.map((x, j) => j === i ? { ...x, einheit: v } : x))}>
                    <SelectTrigger aria-label={`Einheit Position ${i + 1}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EINHEITEN.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <DecimalInput aria-label={`Einzelpreis Position ${i + 1}`} placeholder="Preis" value={r.einzelpreis} onValueChange={n => setRows(rows.map((x, j) => j === i ? { ...x, einzelpreis: n } : x))} />
                  {r.originalRate !== undefined && r.originalRate !== r.einzelpreis && (
                    <p className="mt-1 text-xs text-muted-foreground">Standard {r.originalRate} · angepasst</p>
                  )}
                </div>
                <Button type="button" variant="ghost" size="sm" className="col-span-2 px-0 sm:col-span-1" aria-label={`Position ${i + 1} entfernen`} onClick={() => removeRow(i)}>✕</Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setRows([...rows, { bezeichnung: '', menge: 1, einheit: 'Stück', einzelpreis: 0 }])}>
                <Plus className="h-4 w-4 mr-1.5" />Position
              </Button>
              {typ === 'stunden' && !isEdit && (
                <Button type="button" variant="outline" size="sm" className="text-primary" disabled={!customerId} onClick={openPicker}>
                  <Clock className="h-4 w-4 mr-1.5" />Aus Zeiterfassung
                </Button>
              )}
              {selectedCustomer && hasHosting(selectedCustomer) && (
                <Button type="button" variant="outline" size="sm" className="text-primary" onClick={() => setHostingOpen(true)}>
                  <Server className="h-4 w-4 mr-1.5" />Hosting übernehmen
                </Button>
              )}
            </div>
            {hostingJahr && !rows.some(r => r.hostingJahr) && (
              <p className="text-xs text-muted-foreground">
                Als Hosting-Rechnung {hostingJahr} markiert.{' '}
                <button type="button" className="underline hover:text-foreground" onClick={() => setHostingJahr(null)}>Markierung entfernen</button>
              </p>
            )}
          </div>

          <div className="space-y-1.5"><Label htmlFor="notiz">Notiz</Label><Textarea id="notiz" name="notiz" placeholder="optional" defaultValue={initial?.notiz ?? ''} /></div>
          {edition.material && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="verrechnung_material"
                className="mt-0.5 h-4 w-4 rounded-sm border-input accent-primary"
                defaultChecked={initial?.verrechnungMaterial ?? false}
              />
              <span>
                Mit Material verrechnen (Kundenkonto)
                <span className="block text-xs text-muted-foreground">Wird nicht einzeln bezahlt, sondern im Konto des Kunden mit Materialbezügen gegengerechnet.</span>
              </span>
            </label>
          )}
          <div className="flex flex-col items-end gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Label htmlFor="rabatt_prozent">Rabatt (%)</Label>
              <DecimalInput
                id="rabatt_prozent"
                name="rabatt_prozent"
                className="h-8 w-20 text-right"
                value={rabattProzent}
                onValueChange={n => setRabattProzent(Math.min(100, Math.max(0, n)))}
              />
            </div>
            {rabatt > 0 && (
              <div className="text-muted-foreground tabular-nums text-right">
                <div>Zwischensumme: {formatChf(zwischensumme)}</div>
                <div>Rabatt {rabattProzent}%: − {formatChf(rabatt)}</div>
              </div>
            )}
            <div className="text-base font-medium tabular-nums">Total: {formatChf(total)}</div>
          </div>
          <div className="flex justify-end">
            <Button type="submit"><Save className="h-4 w-4 mr-1.5" />{isEdit ? 'Änderungen speichern' : 'Als Entwurf speichern'}</Button>
          </div>
        </form>
      </CardContent>

      <Dialog open={hostingOpen} onOpenChange={setHostingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hosting übernehmen</DialogTitle>
            <DialogDescription>
              Hosting{selectedCustomerName ? ` für ${selectedCustomerName}` : ''} als Jahresposition hinzufügen. Monate ausserhalb des aktiven Zeitraums werden nicht verrechnet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="hosting-jahr">Jahr</Label>
            <Select value={hostingYear} onValueChange={setHostingYear}>
              <SelectTrigger id="hosting-jahr" className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {HOSTING_YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {hostingPreview ? (
            <div className="rounded-md border p-3 text-sm">
              <div className="font-medium">{hostingPreview.bezeichnung}</div>
              <div className="text-muted-foreground tabular-nums">
                {hostingPreview.menge} {hostingPreview.menge === 1 ? 'Monat' : 'Monate'} × {formatChf(hostingPreview.einzelpreis)} = {formatChf(computeItemTotal(hostingPreview.menge, hostingPreview.einzelpreis))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">In {hostingYear} ist für diesen Kunden kein Hosting aktiv.</p>
          )}

          {hostingAlreadyBilled.length > 0 && (
            <div className="flex gap-2 rounded-md border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Hosting {hostingYear} wurde bereits verrechnet: {hostingAlreadyBilled.map(b => b.rechnungsnummer).join(', ')}.
              </span>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setHostingOpen(false)}>Abbrechen</Button>
            <Button type="button" disabled={!hostingPreview} onClick={addHosting}>
              <Plus className="h-4 w-4 mr-1.5" />Position hinzufügen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto]">
          <DialogHeader>
            <DialogTitle>Aus Zeiterfassung hinzufügen</DialogTitle>
            <DialogDescription>
              Wähle unfakturierte Einträge{selectedCustomerName ? ` für ${selectedCustomerName}` : ''}. Stundensatz kann pro Eintrag angepasst werden.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-9" />
                  <TableHead>Datum</TableHead>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead className="text-right">Std.</TableHead>
                  <TableHead>Satz (Fr.)</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availableEntries.map(e => {
                  const rate = rateOverrides[e.id] ?? e.stundensatz
                  const checked = pickedIds.includes(e.id)
                  return (
                    <TableRow key={e.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`${formatDatum(e.datum)}: ${e.beschreibung} übernehmen`}
                          className="h-4 w-4 rounded-sm border-input accent-primary"
                          checked={checked}
                          onChange={() => setPickedIds(checked ? pickedIds.filter(id => id !== e.id) : [...pickedIds, e.id])}
                        />
                      </TableCell>
                      <TableCell className="tabular-nums">{formatDatum(e.datum)}</TableCell>
                      <TableCell>{e.beschreibung}</TableCell>
                      <TableCell className="text-right">{e.stunden}</TableCell>
                      <TableCell>
                        <DecimalInput
                          aria-label={`Stundensatz für ${formatDatum(e.datum)}`}
                          className="h-8 w-20"
                          value={rate}
                          onValueChange={n => setRateOverrides({ ...rateOverrides, [e.id]: n })}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatBetrag(computeItemTotal(e.stunden, rate), { tabelle: true })}</TableCell>
                    </TableRow>
                  )
                })}
                {availableEntries.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Keine offenen Einträge.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="sm:justify-between sm:items-center">
            <span className="text-sm text-muted-foreground">
              {pickedIds.length} von {availableEntries.length} ausgewählt · Summe {formatChf(pickedSum)}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setPickerOpen(false)}>Abbrechen</Button>
              <Button type="button" disabled={pickedIds.length === 0} onClick={addPicked}>
                <Plus className="h-4 w-4 mr-1.5" />
                {pickedIds.length} Position{pickedIds.length === 1 ? '' : 'en'} hinzufügen
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
