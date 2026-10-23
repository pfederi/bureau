'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ExternalLink, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { formatStunden } from '@/lib/invoices/stats'
import { formatDatum } from '@/lib/utils'
import type { Customer } from '@/lib/types'
import type { SentTimeReport } from '@/lib/db/timeReport'
import { sendTimeReportAction } from './actions'

export type ReportMonth = { monat: string; label: string; stunden: number; anzahl: number }

/** Stundenrapport eines Monats ansehen und an den Kunden senden – nie automatisch. */
export default function TimeReportDialog({ customer, months, defaultMonth, sent, open, onOpenChange }: {
  customer: Customer
  months: ReportMonth[]
  defaultMonth: string | null
  sent: SentTimeReport[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [monat, setMonat] = useState(defaultMonth ?? '')
  const [busy, setBusy] = useState(false)
  const gewaehlt = months.find(m => m.monat === monat)
  const bisher = sent.filter(s => s.monat === monat)

  async function senden() {
    setBusy(true)
    const r = await sendTimeReportAction(customer.id, monat)
    setBusy(false)
    if (!r.ok) { toast.error(r.error ?? 'Senden fehlgeschlagen.'); return }
    toast.success(`Stundenrapport ${gewaehlt?.label ?? ''} an ${customer.email} gesendet`)
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Stundenrapport</DialogTitle>
          <DialogDescription>
            Alle Zeiteinträge eines Monats mit Stunden, ohne Beträge, als PDF. Er geht nur raus, wenn du auf Senden drückst; du bekommst eine Kopie.
          </DialogDescription>
        </DialogHeader>
        {months.length === 0 ? (
          <p className="text-sm text-muted-foreground">Für diesen Kunden gibt es noch keine Zeiteinträge.</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rapport-monat">Monat</Label>
              <Select value={monat} onValueChange={setMonat}>
                <SelectTrigger id="rapport-monat"><SelectValue placeholder="Monat wählen" /></SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m.monat} value={m.monat}>{m.label} · {formatStunden(m.stunden)} Std.</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {gewaehlt && (
                <p className="text-xs text-muted-foreground">
                  {gewaehlt.anzahl} {gewaehlt.anzahl === 1 ? 'Eintrag' : 'Einträge'}, {formatStunden(gewaehlt.stunden)} Std.
                </p>
              )}
              {bisher.length > 0 && (
                <p className="text-xs text-amber-400" role="status">
                  Schon gesendet: {bisher.map(s => `${formatDatum(s.sent_at)} an ${s.an}`).join(', ')}
                </p>
              )}
            </div>
            {!customer.email && (
              <p className="text-sm text-amber-400">Beim Kunden ist keine E-Mail-Adresse erfasst. Ergänze sie unter Bearbeiten, um den Rapport zu senden.</p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button asChild variant="outline" disabled={!monat}>
                <a href={`/api/admin/kunden/${customer.id}/rapport?monat=${monat}&inline=1`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1.5" />Vorschau
                </a>
              </Button>
              <Button type="button" disabled={busy || !monat || !customer.email} onClick={senden} className="max-w-full">
                <Send className="h-4 w-4 mr-1.5 shrink-0" />
                <span className="truncate">{busy ? 'Senden…' : customer.email ? `An ${customer.email} senden` : 'Senden'}</span>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
