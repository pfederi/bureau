'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, Paperclip, Plus, Save, Sparkles, Upload, X } from 'lucide-react'
import type { Currency, Expense, ExpenseCategory } from '@/lib/types'
import { CURRENCIES, toChf, type ChfRate } from '@/lib/expenses/currency'
import type { ExtractedExpense } from '@/lib/expenses/extract'
import { formatDatum } from '@/lib/utils'
import { EXPENSE_CATEGORIES } from '@/lib/expenses/categories'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { addExpenseAction, updateExpenseAction, checkDuplicatesAction } from './actions'

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/heic'

// Wird bei jedem Öffnen neu gemountet, damit die Vorbelegung frisch ist.
function ExpenseFields({ expense, vorlage, today, onDone }: { expense?: Expense; vorlage?: Partial<Expense>; today: string; onDone: () => void }) {
  // Neue Ausgabe aus einer Vorlage (z. B. wiederkehrender Beleg): nur Startwerte, keine ID
  const start = expense ?? vorlage
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [kategorie, setKategorie] = useState<ExpenseCategory>(start?.kategorie ?? 'software')
  const [beleg, setBeleg] = useState<{ path: string; name: string } | null>(
    expense?.beleg_path ? { path: expense.beleg_path, name: expense.beleg_name ?? 'Beleg' } : null,
  )
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)

  // Fremdwährung: Franken-Betrag zum EZB-Kurs vorschlagen, bis er von Hand geändert wird
  const [datum, setDatum] = useState(start?.datum ?? today)
  const [waehrung, setWaehrung] = useState<Currency>(start?.waehrung ?? 'CHF')
  const [original, setOriginal] = useState(start?.betrag_original != null ? String(start.betrag_original) : '')
  const [chf, setChf] = useState(start?.betrag != null ? String(start.betrag) : '')
  const [chfManuell, setChfManuell] = useState(!!expense && expense.waehrung !== 'CHF')
  const [kurs, setKurs] = useState<ChfRate | null>(null)
  const [kursFehler, setKursFehler] = useState('')
  const [beschreibung, setBeschreibung] = useState(start?.beschreibung ?? '')
  const [lieferant, setLieferant] = useState(start?.lieferant ?? '')
  // Auslesen des Belegs (nur bei neuen Ausgaben, damit Bearbeitetes nicht überschrieben wird)
  const [auslesen, setAuslesen] = useState<'' | 'laeuft' | 'fertig' | string>('')

  // Duplikat-Prüfung: Hinweis während der Eingabe; gespeichert wird dann bewusst über «Trotzdem speichern»
  const [duplikate, setDuplikate] = useState<string[]>([])
  useEffect(() => {
    const betrag = Number(chf)
    if (!beschreibung.trim() && !beleg && !(datum && betrag > 0)) { setDuplikate([]); return }
    let aktiv = true
    const t = setTimeout(async () => {
      const treffer = await checkDuplicatesAction({
        id: expense?.id, datum, betrag, waehrung,
        betrag_original: original ? Number(original) : null,
        beschreibung, beleg_name: beleg?.name ?? null,
      }).catch(() => [])
      if (aktiv) setDuplikate(treffer)
    }, 400)
    return () => { aktiv = false; clearTimeout(t) }
  }, [datum, chf, original, waehrung, beschreibung, beleg, expense?.id])

  async function ausBelegVorschlagen(path: string) {
    setAuslesen('laeuft')
    try {
      const res = await fetch('/api/admin/expenses/extract', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setAuslesen(data.error ?? 'Beleg konnte nicht ausgelesen werden.'); return }
      const v = data as ExtractedExpense
      if (v.datum) setDatum(v.datum)
      if (v.lieferant) setLieferant(v.lieferant)
      if (v.beschreibung) setBeschreibung(v.beschreibung)
      if (v.kategorie) setKategorie(v.kategorie)
      if (v.betrag) {
        const w = v.waehrung ?? 'CHF'
        setWaehrung(w)
        if (w === 'CHF') { setChf(v.betrag.toFixed(2)); setOriginal('') }
        else { setOriginal(v.betrag.toFixed(2)); setChfManuell(false) }
      }
      setAuslesen(Object.keys(v).length ? 'fertig' : 'Im Beleg wurden keine Angaben erkannt.')
    } catch {
      setAuslesen('Beleg konnte nicht ausgelesen werden.')
    }
  }

  useEffect(() => {
    if (waehrung === 'CHF' || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) { setKurs(null); return }
    let aktiv = true
    setKursFehler('')
    fetch(`/api/admin/exchange-rate?waehrung=${waehrung}&datum=${datum}`)
      .then(async r => (r.ok ? r.json() : Promise.reject((await r.json().catch(() => ({}))).error)))
      .then((rate: ChfRate) => { if (aktiv) setKurs(rate) })
      .catch(err => { if (aktiv) { setKurs(null); setKursFehler(typeof err === 'string' ? err : 'Kurs nicht verfügbar.') } })
    return () => { aktiv = false }
  }, [waehrung, datum])

  useEffect(() => {
    const betrag = Number(original)
    if (waehrung !== 'CHF' && kurs && betrag > 0 && !chfManuell) setChf(toChf(betrag, kurs.kurs).toFixed(2))
  }, [kurs, original, waehrung, chfManuell])

  async function upload(file: File) {
    const fd = new FormData()
    fd.append('file', file)
    setUploading(true)
    try {
      const res = await fetch('/api/admin/expenses/upload', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error ?? 'Upload fehlgeschlagen.'); return }
      setBeleg({ path: data.path, name: data.name })
      toast.success('Beleg hochgeladen')
      if (!expense) void ausBelegVorschlagen(data.path)
    } catch {
      toast.error('Upload fehlgeschlagen.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function save(formData: FormData) {
    setBusy(true)
    const r = expense ? await updateExpenseAction(expense.id, formData) : await addExpenseAction(formData)
    setBusy(false)
    if (!r.ok) { toast.error(r.error ?? 'Speichern fehlgeschlagen.'); return }
    toast.success(expense ? 'Ausgabe aktualisiert' : 'Ausgabe erfasst')
    onDone()
    router.refresh()
  }

  return (
    <form action={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <input type="hidden" name="beleg_path" value={beleg?.path ?? ''} />
      <input type="hidden" name="beleg_name" value={beleg?.name ?? ''} />
      <input type="hidden" name="waehrung" value={waehrung} />
      <div className="space-y-1.5 md:col-span-2">
        <span className="block py-[5px] text-sm font-medium leading-none">Beleg</span>
        <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }} />
        <div className="flex flex-wrap items-center gap-2">
          {beleg ? (
            <span className="inline-flex min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{beleg.name}</span>
              <button type="button" onClick={() => setBeleg(null)} aria-label="Beleg entfernen" className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
                <X className="h-4 w-4" />
              </button>
            </span>
          ) : null}
          <Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1.5" />{uploading ? 'Lädt hoch…' : beleg ? 'Ersetzen' : 'Beleg hochladen'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          PDF oder Foto, max. 10 MB. Belege 10 Jahre aufbewahren.{!expense && ' Beim Hochladen werden die Felder aus dem Beleg vorgeschlagen.'}
        </p>
        {auslesen && (
          <p className={auslesen === 'laeuft' || auslesen === 'fertig' ? 'flex items-center gap-1.5 text-xs text-primary' : 'text-xs text-amber-400'} aria-live="polite">
            {(auslesen === 'laeuft' || auslesen === 'fertig') && <Sparkles className="h-3.5 w-3.5" aria-hidden />}
            {auslesen === 'laeuft' ? 'Beleg wird ausgelesen…' : auslesen === 'fertig' ? 'Felder aus dem Beleg vorgeschlagen – bitte prüfen.' : auslesen}
          </p>
        )}
      </div>
      <div className="space-y-1.5"><Label htmlFor="datum">Datum</Label><Input id="datum" name="datum" type="date" value={datum} onChange={e => setDatum(e.target.value)} required /></div>
      <div className="space-y-1.5"><Label htmlFor="waehrung">Währung</Label>
        <Select value={waehrung} onValueChange={v => { setWaehrung(v as Currency); setChfManuell(false) }}>
          <SelectTrigger id="waehrung"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CURRENCIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {waehrung !== 'CHF' && (
        <div className="space-y-1.5"><Label htmlFor="betrag_original">Betrag ({waehrung})</Label>
          <DecimalInput id="betrag_original" name="betrag_original" value={original} onChange={e => setOriginal(e.target.value)} required />
        </div>
      )}
      <div className={waehrung === 'CHF' ? 'space-y-1.5 md:col-span-2' : 'space-y-1.5'}>
        <Label htmlFor="betrag">Betrag (Fr.)</Label>
        <DecimalInput id="betrag" name="betrag" value={chf} onChange={e => { setChf(e.target.value); setChfManuell(true) }} required aria-describedby={waehrung !== 'CHF' ? 'kurs-hinweis' : undefined} />
      </div>
      {waehrung !== 'CHF' && (
        <p id="kurs-hinweis" className="text-xs text-muted-foreground md:col-span-2" aria-live="polite">
          {kurs ? <>1 {waehrung} = {kurs.kurs} Fr. ({kurs.quelle}, {formatDatum(kurs.datum)}). </> : kursFehler ? <>{kursFehler} </> : 'Kurs wird geladen… '}
          Steht der effektiv belastete Betrag fest (Kreditkarte, Bank), trage ihn als Franken-Betrag ein.
          {chfManuell && kurs && Number(original) > 0 && (
            <> <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => setChfManuell(false)}>Kurs übernehmen</button></>
          )}
        </p>
      )}
      <div className="space-y-1.5 md:col-span-2"><Label htmlFor="beschreibung">Beschreibung</Label><Input id="beschreibung" name="beschreibung" placeholder="z. B. Adobe Creative Cloud, Oktober" value={beschreibung} onChange={e => setBeschreibung(e.target.value)} required /></div>
      <div className="space-y-1.5"><Label htmlFor="lieferant">Lieferant <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="lieferant" name="lieferant" value={lieferant} onChange={e => setLieferant(e.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="kategorie">Kategorie</Label>
        <Select name="kategorie" required value={kategorie} onValueChange={v => setKategorie(v as ExpenseCategory)}>
          <SelectTrigger id="kategorie"><SelectValue /></SelectTrigger>
          <SelectContent>
            {EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {duplikate.length > 0 && (
        <div className="md:col-span-2 flex gap-2 rounded-md border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Mögliches Duplikat</p>
            <ul className="mt-1 space-y-0.5 text-xs">{duplikate.map(d => <li key={d}>{d}</li>)}</ul>
            <p className="mt-1 text-xs">Ist es keine doppelte Ausgabe, speichere mit „Trotzdem speichern“.</p>
          </div>
        </div>
      )}
      <div className="md:col-span-2 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}><X className="h-4 w-4 mr-1.5" />Abbrechen</Button>
        <Button type="submit" disabled={busy || uploading}>
          {duplikate.length > 0
            ? <><AlertTriangle className="h-4 w-4 mr-1.5" />Trotzdem speichern</>
            : expense ? <><Save className="h-4 w-4 mr-1.5" />Speichern</> : <><Plus className="h-4 w-4 mr-1.5" />Ausgabe speichern</>}
        </Button>
      </div>
    </form>
  )
}

/** Dialog zum Erfassen oder Bearbeiten einer Ausgabe. */
export function ExpenseDialog({ open, onOpenChange, expense, vorlage, today }: {
  open: boolean; onOpenChange: (open: boolean) => void; expense?: Expense; vorlage?: Partial<Expense>; today: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{expense ? 'Ausgabe bearbeiten' : 'Neue Ausgabe'}</DialogTitle>
          <DialogDescription>Geschäftlich begründete Kosten mit Beleg erfassen.</DialogDescription>
        </DialogHeader>
        <ExpenseFields expense={expense} vorlage={vorlage} today={today} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

export function NewExpenseButton({ today }: { today: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Neue Ausgabe</Button>
      <ExpenseDialog open={open} onOpenChange={setOpen} today={today} />
    </>
  )
}
