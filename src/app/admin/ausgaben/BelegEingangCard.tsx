'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FileSearch, Paperclip, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { formatWaehrung } from '@/lib/invoices/stats'
import { formatDatum } from '@/lib/utils'
import type { BelegEingang } from '@/lib/db/belegEingang'
import type { Expense } from '@/lib/types'
import { ExpenseDialog } from './ExpenseDialog'
import { discardBelegEingangAction } from './actions'

function vorlageAus(e: BelegEingang): Partial<Expense> {
  const v = e.vorschlag ?? {}
  const fremd = v.waehrung && v.waehrung !== 'CHF'
  return {
    datum: v.datum, beschreibung: v.beschreibung ?? '', lieferant: v.lieferant ?? null, kategorie: v.kategorie,
    waehrung: v.waehrung ?? 'CHF',
    betrag: fremd ? undefined : v.betrag,
    betrag_original: fremd ? v.betrag ?? null : null,
  } as Partial<Expense>
}

/** Per Mail weitergeleitete Belege, die noch geprüft und als Ausgabe gespeichert werden müssen. */
export default function BelegEingangCard({ eintraege, today }: { eintraege: BelegEingang[]; today: string }) {
  const router = useRouter()
  const [pruefen, setPruefen] = useState<BelegEingang | null>(null)
  const [verwerfen, setVerwerfen] = useState<BelegEingang | null>(null)
  const [busy, setBusy] = useState(false)
  if (eintraege.length === 0) return null

  async function weg(e: BelegEingang) {
    setBusy(true)
    const r = await discardBelegEingangAction(e.id)
    setBusy(false)
    setVerwerfen(null)
    if (!r.ok) { toast.error(r.error ?? 'Verwerfen fehlgeschlagen.'); return }
    toast.success('Beleg verworfen')
    router.refresh()
  }

  return (
    <Card>
      <CardContent className="pt-4 sm:pt-6">
        <h2 className="karte-titel -mt-3 py-3 text-sm font-medium">Neue Belege per Mail ({eintraege.length})</h2>
        <ul className="divide-y">
          {eintraege.map(e => {
            const v = e.vorschlag ?? {}
            const name = e.beleg_name ?? e.betreff ?? 'Mail ohne Beleg'
            return (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 space-y-0.5">
                  <div className="font-medium wrap-anywhere">{v.lieferant ?? e.absender}</div>
                  <div className="text-xs tabular-nums text-muted-foreground">
                    {v.betrag != null ? `${formatWaehrung(v.betrag, v.waehrung ?? 'CHF')} · ` : ''}{formatDatum(v.datum ?? e.created_at)}
                    {e.betreff ? ` · ${e.betreff}` : ''}
                  </div>
                  {e.hinweis && <div className="text-xs text-amber-400">{e.hinweis}</div>}
                  {e.beleg_path && (
                    <a href={`/api/admin/beleg-eingang/${e.id}/beleg`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <Paperclip className="h-3 w-3" aria-hidden />{name}<span className="sr-only"> (öffnet in neuem Tab)</span>
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" aria-label={`${name} verwerfen`} onClick={() => setVerwerfen(e)}><Trash2 className="h-4 w-4 mr-1.5" />Verwerfen</Button>
                  {e.beleg_path && <Button aria-label={`${name} prüfen`} onClick={() => setPruefen(e)}><FileSearch className="h-4 w-4 mr-1.5" />Prüfen</Button>}
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
      <ExpenseDialog
        open={pruefen !== null}
        onOpenChange={o => { if (!o) setPruefen(null) }}
        vorlage={pruefen ? vorlageAus(pruefen) : undefined}
        eingang={pruefen?.beleg_path ? { id: pruefen.id, path: pruefen.beleg_path, name: pruefen.beleg_name ?? 'Beleg' } : undefined}
        today={today}
      />
      <AlertDialog open={verwerfen !== null} onOpenChange={o => { if (!o && !busy) setVerwerfen(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Beleg verwerfen?</AlertDialogTitle>
            <AlertDialogDescription>«{verwerfen?.beleg_name ?? 'Beleg'}» wird aus dem Eingang gelöscht, samt Datei.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={busy} aria-busy={busy} onClick={ev => { ev.preventDefault(); if (verwerfen) void weg(verwerfen) }}>Verwerfen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
