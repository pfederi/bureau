'use client'
import { useState } from 'react'
import type { Customer } from '@/lib/types'
import { createQuoteAction, updateQuoteAction } from './actions'
import { computeItemTotal, computeDiscountedTotals } from '@/lib/invoices/calc'
import { formatChf } from '@/lib/invoices/stats'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Plus, Save } from 'lucide-react'

type Row = { bezeichnung: string; menge: number; einheit: string; einzelpreis: number }

type InitialQuote = {
  quoteId: string
  customerId: string
  offertdatum: string
  gueltigBis: string
  notiz: string
  rabattProzent: number
  rows: Row[]
}

const EINHEITEN = ['Stück', 'Std.', 'Pauschal', 'Tag', 'km', 'Monat', 'Jahr']

/** Gültigkeit standardmässig 30 Tage ab Offertdatum. */
function plus30(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 30)
  return d.toISOString().slice(0, 10)
}

export default function QuoteForm({ customers, mwstHinweis, today, initial, defaultCustomerId }: {
  customers: Customer[]; mwstHinweis: string; today: string; initial?: InitialQuote; defaultCustomerId?: string
}) {
  const isEdit = !!initial
  const [customerId, setCustomerId] = useState(initial?.customerId ?? (customers.some(c => c.id === defaultCustomerId) ? defaultCustomerId! : ''))
  const [rows, setRows] = useState<Row[]>(initial?.rows ?? [{ bezeichnung: '', menge: 1, einheit: 'Stück', einzelpreis: 0 }])
  const [rabattProzent, setRabattProzent] = useState(initial?.rabattProzent ?? 0)
  const zwischensumme = rows.reduce((s, r) => s + computeItemTotal(r.menge, r.einzelpreis), 0)
  const { rabatt, total } = computeDiscountedTotals(zwischensumme, rabattProzent)
  const update = (i: number, patch: Partial<Row>) => setRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  const action = isEdit ? updateQuoteAction.bind(null, initial.quoteId) : createQuoteAction

  return (
    <Card>
      <CardContent className="pt-4 sm:pt-6">
        <form action={action} className="space-y-4">
          <input type="hidden" name="items" value={JSON.stringify(rows)} />
          <input type="hidden" name="mwst_hinweis" value={mwstHinweis} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5"><Label htmlFor="kunde">Kunde</Label>
              <Select name="customer_id" required value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger id="kunde"><SelectValue placeholder="wählen…" /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.firma_oder_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="offertdatum">Offertdatum</Label><Input id="offertdatum" name="offertdatum" type="date" defaultValue={initial?.offertdatum ?? today} required /></div>
            <div className="space-y-1.5"><Label htmlFor="gueltig_bis">Gültig bis</Label><Input id="gueltig_bis" name="gueltig_bis" type="date" defaultValue={initial ? initial.gueltigBis : plus30(today)} /></div>
          </div>

          <div className="space-y-2">
            <Label>Positionen</Label>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-12 items-start gap-2 border-b pb-3 last:border-0 sm:border-0 sm:pb-0">
                <Input aria-label={`Bezeichnung Position ${i + 1}`} className="col-span-12 sm:col-span-6" placeholder="Bezeichnung" value={r.bezeichnung} onChange={e => update(i, { bezeichnung: e.target.value })} />
                <DecimalInput aria-label={`Menge Position ${i + 1}`} placeholder="Menge" className="col-span-3 sm:col-span-1" value={r.menge} onValueChange={n => update(i, { menge: n })} />
                <div className="col-span-4 sm:col-span-2">
                  <Select value={r.einheit} onValueChange={v => update(i, { einheit: v })}>
                    <SelectTrigger aria-label={`Einheit Position ${i + 1}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EINHEITEN.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <DecimalInput aria-label={`Einzelpreis Position ${i + 1}`} placeholder="Preis" className="col-span-3 sm:col-span-2" value={r.einzelpreis} onValueChange={n => update(i, { einzelpreis: n })} />
                <Button type="button" variant="ghost" size="sm" className="col-span-2 px-0 sm:col-span-1" aria-label={`Position ${i + 1} entfernen`} onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setRows([...rows, { bezeichnung: '', menge: 1, einheit: 'Stück', einzelpreis: 0 }])}>
              <Plus className="h-4 w-4 mr-1.5" />Position
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notiz">Text auf der Offerte</Label>
            <Textarea id="notiz" name="notiz" rows={4} placeholder="optional, z. B. Leistungsbeschrieb, Termine, Konditionen" defaultValue={initial?.notiz ?? ''} />
          </div>

          <div className="flex flex-col items-end gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Label htmlFor="rabatt_prozent">Rabatt (%)</Label>
              <DecimalInput id="rabatt_prozent" name="rabatt_prozent" className="h-8 w-20 text-right"
                value={rabattProzent} onValueChange={n => setRabattProzent(Math.min(100, Math.max(0, n)))} />
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
    </Card>
  )
}
