'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Server, AlertTriangle } from 'lucide-react'
import type { Customer } from '@/lib/types'
import type { HostingBilled } from '@/lib/db/invoices'
import { hasHosting, hostingItemForYear, hostingYears } from '@/lib/invoices/hosting'
import { computeItemTotal } from '@/lib/invoices/calc'
import { formatChf, formatBetrag } from '@/lib/invoices/stats'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { createHostingInvoicesAction } from './actions'

// Hosting wird oft im Voraus verrechnet, darum auch das nächste Jahr anbieten.
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = hostingYears()

/** Hosting-Jahresrechnungen für mehrere Kunden auf einmal als Entwürfe erstellen. */
export default function HostingBulkDialog({ customers, hostingBilled, initialJahr }: { customers: Customer[]; hostingBilled: HostingBilled[]; initialJahr?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [jahr, setJahr] = useState(initialJahr && YEARS.includes(initialJahr) ? initialJahr : String(CURRENT_YEAR))
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const rows = customers
    .filter(hasHosting)
    .map(c => {
      const item = hostingItemForYear(c, Number(jahr))
      const billed = hostingBilled.find(b => b.customer_id === c.id && b.hosting_jahr === Number(jahr))
      return { c, item, billed }
    })
    .filter(r => r.item)

  // Vorauswahl: alle, die für das Jahr noch nicht verrechnet sind.
  function preselect(j: string) {
    setSelected(customers
      .filter(c => hasHosting(c) && hostingItemForYear(c, Number(j))
        && !hostingBilled.some(b => b.customer_id === c.id && b.hosting_jahr === Number(j)))
      .map(c => c.id))
  }

  function openDialog() {
    preselect(jahr)
    setOpen(true)
  }

  // Aus den Todos (?hosting=Jahr): Dialog gleich offen, Jahr vorgewählt
  useEffect(() => {
    if (initialJahr && YEARS.includes(initialJahr)) openDialog()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialJahr])

  const total = rows
    .filter(r => selected.includes(r.c.id))
    .reduce((s, r) => s + computeItemTotal(r.item!.menge, r.item!.einzelpreis), 0)

  async function create() {
    setBusy(true)
    const r = await createHostingInvoicesAction(Number(jahr), selected)
    setBusy(false)
    if (!r.ok) {
      toast.error(r.error ?? 'Erstellen fehlgeschlagen.')
      return
    }
    toast.success(`${r.count} Hosting-${r.count === 1 ? 'Rechnung' : 'Rechnungen'} ${jahr} als Entwurf erstellt`)
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <Button variant="outline" onClick={openDialog}><Server className="h-4 w-4 mr-1.5" />Hosting-Rechnungen</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Hosting-Rechnungen erstellen</DialogTitle>
            <DialogDescription>Für jeden gewählten Kunden entsteht ein Rechnungsentwurf mit dem Hosting des Jahres (anteilig nach aktiven Monaten).</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="hosting-jahr">Jahr</Label>
            <Select value={jahr} onValueChange={v => { setJahr(v); preselect(v) }}>
              <SelectTrigger id="hosting-jahr" className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Kein Kunde hat {jahr} ein aktives Hosting.</p>
          ) : (
            <ul className="space-y-2">
              {rows.map(({ c, item, billed }) => (
                <li key={c.id}>
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded-sm border-input accent-primary"
                      checked={selected.includes(c.id)}
                      onChange={e => setSelected(e.target.checked ? [...selected, c.id] : selected.filter(id => id !== c.id))}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{c.firma_oder_name}</span>
                      <span className="block text-xs text-muted-foreground">{item!.bezeichnung} · {item!.menge} × {formatChf(item!.einzelpreis)}</span>
                      {billed && (
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-amber-400">
                          <AlertTriangle className="h-3 w-3" />Bereits verrechnet ({billed.rechnungsnummer})
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums">{formatBetrag(computeItemTotal(item!.menge, item!.einzelpreis), { tabelle: true })}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter className="items-center gap-2 sm:justify-between">
            <span className="text-sm text-muted-foreground tabular-nums">{selected.length} gewählt · {formatChf(total)}</span>
            <Button disabled={busy || selected.length === 0} onClick={create}>
              {selected.length === 1 ? '1 Entwurf erstellen' : `${selected.length} Entwürfe erstellen`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
