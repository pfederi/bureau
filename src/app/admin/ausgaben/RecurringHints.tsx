'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarClock, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatWaehrung } from '@/lib/invoices/stats'
import { formatDatum } from '@/lib/utils'
import { hideId, type MissingRecurring } from '@/lib/expenses/recurring'
import type { Expense } from '@/lib/types'
import { ExpenseDialog } from './ExpenseDialog'
import { hideRecurringAction } from './actions'

// Früher nur im Browser gespeichert (Reihe@erwartet) – wird einmalig in die Datenbank übernommen
const ALT_KEY = 'admin-ausgaben-ausgeblendet'

function vorlageAus(m: MissingRecurring): Partial<Expense> {
  return {
    datum: m.erwartet,
    lieferant: m.lieferant,
    beschreibung: m.beschreibung,
    kategorie: m.kategorie,
    waehrung: m.waehrung,
    // Fremdwährung: Originalbetrag vorgeben, Franken rechnet der Dialog zum Tageskurs
    ...(m.waehrung === 'CHF' ? { betrag: m.betrag } : { betrag_original: m.betrag }),
  }
}

/** Hinweis auf überfällige Belege wiederkehrender Ausgaben, mit vorausgefülltem Erfassen. */
export default function RecurringHints({ hints, today }: { hints: MissingRecurring[]; today: string }) {
  const router = useRouter()
  const [hidden, setHidden] = useState<string[]>([])
  const [vorlage, setVorlage] = useState<Partial<Expense> | null>(null)

  useEffect(() => {
    let alt: string[] = []
    try { alt = JSON.parse(localStorage.getItem(ALT_KEY) ?? '[]') } catch { return }
    const ids = hints.filter(m => alt.includes(`${m.key}@${m.erwartet}`)).map(hideId)
    const fertig = () => { try { localStorage.removeItem(ALT_KEY) } catch { /* egal */ } }
    if (ids.length === 0) { if (alt.length) fertig(); return }
    setHidden(ids)
    void hideRecurringAction(ids).then(r => { if (r.ok) { fertig(); router.refresh() } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function hide(m: MissingRecurring) {
    const id = hideId(m)
    setHidden(h => [...h, id])
    const r = await hideRecurringAction([id])
    if (!r.ok) {
      setHidden(h => h.filter(x => x !== id))
      toast.error(r.error ?? 'Ausblenden fehlgeschlagen.')
      return
    }
    toast.success(`${m.beschreibung} ausgeblendet`)
    router.refresh()
  }

  const sichtbar = hints.filter(m => !hidden.includes(hideId(m)))
  if (sichtbar.length === 0) return null

  return (
    <Card className="border-amber-700/60">
      <CardContent className="pt-4 sm:pt-6">
        <div className="flex items-start gap-3">
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Fehlende Belege?</div>
            <p className="text-xs text-muted-foreground">
              Diese Ausgaben kommen regelmässig, der nächste Beleg fehlt noch. Gekündigtes einfach ausblenden.
            </p>
            <ul className="mt-3 divide-y rounded-md border">
              {sichtbar.map(m => (
                <li key={hideId(m)} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{m.beschreibung}</div>
                    <div className="text-xs text-muted-foreground">
                      {[m.lieferant, m.frequenz === 'monatlich' ? 'monatlich' : 'jährlich'].filter(Boolean).join(' · ')}
                      {' · '}erwartet {formatDatum(m.erwartet)} · zuletzt {formatWaehrung(m.betrag, m.waehrung)} am {formatDatum(m.letztes)}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="outline" onClick={() => setVorlage(vorlageAus(m))}>
                      <Plus className="h-4 w-4 mr-1" />Erfassen
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`${m.beschreibung} ausblenden`} title="Ausblenden" onClick={() => hide(m)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
      <ExpenseDialog
        open={vorlage !== null}
        onOpenChange={open => { if (!open) setVorlage(null) }}
        vorlage={vorlage ?? undefined}
        today={today}
      />
    </Card>
  )
}
