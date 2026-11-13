'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, FileText, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { formatChf } from '@/lib/invoices/stats'
import { formatDatum } from '@/lib/utils'
import { antwortDatum, offerteZustand, type PortalQuote } from '@/lib/portal/quotes'
import { portalText, type Anrede } from '@/lib/portal/text'
import { Aufploppen } from '@/app/admin/Bewegung'
import { HAEKCHEN } from '@/app/admin/useBestaetigung'

type Offen = { quote: PortalQuote; art: 'annehmen' | 'ablehnen' }

/** Offerten im Kundenlink: PDF, Status und – solange gültig – annehmen oder ablehnen. */
export default function PortalQuotesCard({ token, anrede, heute, quotes }: { token: string; anrede: Anrede; heute: string; quotes: PortalQuote[] }) {
  const router = useRouter()
  const t = portalText(anrede)
  const [dialog, setDialog] = useState<Offen | null>(null)
  const [name, setName] = useState('')
  const [grund, setGrund] = useState('')
  const [bestaetigt, setBestaetigt] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [danke, setDanke] = useState<string | null>(null)
  // Immer vorhanden: so liest der Screenreader die Meldung vor, und der Fokus hat ein Ziel, wenn die Knöpfe verschwinden
  const statusRef = useRef<HTMLParagraphElement>(null)
  const fokusAufStatus = useRef(false)

  const sichtbar = quotes.filter(q => offerteZustand(q, heute) !== null)
  if (sichtbar.length === 0) return null

  function oeffnen(quote: PortalQuote, art: Offen['art']) {
    setDialog({ quote, art }); setName(''); setGrund(''); setBestaetigt(false); setFehler(null)
  }

  async function senden(e: React.FormEvent) {
    e.preventDefault()
    if (!dialog) return
    setBusy(true); setFehler(null)
    const res = await fetch(`/kunde/${encodeURIComponent(token)}/offerte/${dialog.quote.id}/antwort`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ antwort: dialog.art, name, grund, bestaetigt: dialog.art === 'annehmen' ? bestaetigt : undefined }),
    }).catch(() => null)
    setBusy(false)
    const data = res ? await res.json().catch(() => ({})) : {}
    if (!res?.ok) {
      setFehler(data.error ?? 'Das hat leider nicht geklappt. Bitte später nochmals versuchen.')
      // Schon beantwortet oder abgelaufen: Liste neu laden, damit die Knöpfe verschwinden
      if (res?.status === 409) router.refresh()
      return
    }
    setDanke(dialog.art === 'annehmen' ? t.angenommenDank : t.abgelehntDank)
    setDialog(null)
    fokusAufStatus.current = true
    router.refresh()
  }

  return (
    <Card>
      <CardContent className="pt-4 sm:pt-6">
        <h2 className="karte-titel -mt-3 py-3 text-sm font-medium">Offerten</h2>
        <p ref={statusRef} role="status" tabIndex={-1} className={danke ? 'mb-3 flex items-center gap-2 rounded-md border border-green-500/40 px-3 py-2 text-sm text-green-400 outline-hidden focus-visible:ring-2 focus-visible:ring-ring' : 'sr-only'}>
          {danke && <Check key={danke} className={`h-4 w-4 shrink-0 ${HAEKCHEN}`} aria-hidden />}{danke}
        </p>
        <ul className="divide-y">
          {sichtbar.map(q => {
            const zustand = offerteZustand(q, heute)
            return (
              <li key={q.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 space-y-1">
                  <a href={`/kunde/${encodeURIComponent(token)}/offerte/${q.id}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-medium text-blue-300 hover:underline wrap-anywhere">
                    <FileText className="h-4 w-4 shrink-0" aria-hidden />{q.offertnummer}
                  </a>
                  <div className="text-xs tabular-nums text-muted-foreground">
                    {formatDatum(q.offertdatum)} · {formatChf(Number(q.betrag))}
                    {zustand === 'offen' && (q.gueltig_bis ? ` · gültig bis ${formatDatum(q.gueltig_bis)}` : ' · offen')}
                  </div>
                  {/* Immer vorhanden, damit der Wechsel von «offen» zu «angenommen» aufploppt */}
                  <Aufploppen wert={zustand ?? ''} als="div" className="origin-left space-y-1">
                    {zustand === 'abgelaufen' && (
                      <p className="text-xs text-amber-400">Abgelaufen am {formatDatum(q.gueltig_bis)}. {t.neueOfferte}</p>
                    )}
                    {(zustand === 'angenommen' || zustand === 'abgelehnt') && (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className={zustand === 'angenommen' ? 'border-green-500 text-green-400' : 'text-muted-foreground'}>
                          {zustand === 'angenommen' ? 'Angenommen' : 'Abgelehnt'}
                        </Badge>
                        {q.antwort_am && q.antwort_name && <span>am {antwortDatum(q.antwort_am)} von {q.antwort_name}</span>}
                      </div>
                    )}
                  </Aufploppen>
                </div>
                {zustand === 'offen' && (
                  <div className="flex gap-2">
                    <Button variant="outline" aria-label={`Offerte ${q.offertnummer} ablehnen`} onClick={() => oeffnen(q, 'ablehnen')}><X className="h-4 w-4 mr-1.5" />Ablehnen</Button>
                    <Button aria-label={`Offerte ${q.offertnummer} annehmen`} onClick={() => oeffnen(q, 'annehmen')}><Check className="h-4 w-4 mr-1.5" />Offerte annehmen</Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>

      <Dialog open={dialog !== null} onOpenChange={o => { if (!o && !busy) setDialog(null) }}>
        <DialogContent
          className="sm:max-w-md"
          // Nach einer Antwort verschwindet der auslösende Knopf: Fokus auf die Meldung statt ins Leere
          onCloseAutoFocus={e => { if (fokusAufStatus.current) { e.preventDefault(); fokusAufStatus.current = false; statusRef.current?.focus() } }}
        >
          {dialog && (
            <form onSubmit={senden} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Offerte {dialog.quote.offertnummer} {dialog.art === 'annehmen' ? 'annehmen' : 'ablehnen'}</DialogTitle>
                <DialogDescription>
                  Betrag {formatChf(Number(dialog.quote.betrag))}{dialog.quote.gueltig_bis ? `, gültig bis ${formatDatum(dialog.quote.gueltig_bis)}` : ''}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="antwort-name">{t.name}</Label>
                <Input id="antwort-name" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={100} autoComplete="name" autoFocus />
              </div>
              {dialog.art === 'ablehnen' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="antwort-grund">Grund <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Textarea id="antwort-grund" rows={3} maxLength={1000} value={grund} onChange={e => setGrund(e.target.value)} />
                </div>
              ) : (
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" required checked={bestaetigt} onChange={e => setBestaetigt(e.target.checked)} className="mt-0.5 h-4 w-4 rounded-sm border-input accent-primary" />
                  <span>Ich nehme diese Offerte an.</span>
                </label>
              )}
              {fehler && <p role="alert" className="text-sm text-destructive">{fehler}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={busy} onClick={() => setDialog(null)}>Abbrechen</Button>
                <Button type="submit" disabled={busy} aria-busy={busy}>{dialog.art === 'annehmen' ? 'Offerte annehmen' : 'Offerte ablehnen'}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
