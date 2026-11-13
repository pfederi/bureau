'use client'
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { gespeichertSpeicher, neueIds, zwischenwert } from '@/lib/bewegung'
import { formatBetrag } from '@/lib/invoices/stats'

// Mikroanimationen im Admin und auf der Kundenseite. Alles mit motion-safe bzw. Prüfung von
// «Bewegung reduzieren»; Dauer höchstens 300 ms (CLAUDE.md).

const speicher = gespeichertSpeicher()

/** Nach dem Speichern aufrufen (vor router.refresh()): die Zeile mit dieser ID leuchtet kurz auf. */
export function markiereGespeichert(id: string | null | undefined) {
  if (id) speicher.markiere(id)
}

const bewegungReduziert = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Tabellenzeile, die nach dem Speichern kurz hervorgehoben wird (Hintergrund, blendet in 300 ms aus).
 * Die Farbe selbst ist keine Bewegung und erscheint auch mit «Bewegung reduzieren».
 */
export function Zeile({ id, className, ...props }: { id: string } & ComponentProps<typeof TableRow>) {
  const [hell, setHell] = useState(false)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const zeigen = () => {
      setHell(true)
      clearTimeout(timer)
      timer = setTimeout(() => setHell(false), 1500)
    }
    if (speicher.nimm(id)) zeigen()
    const weg = speicher.hoere(gemeldet => { if (gemeldet === id && speicher.nimm(id)) zeigen() })
    return () => { weg(); clearTimeout(timer) }
  }, [id])
  return (
    <TableRow
      {...props}
      data-gespeichert={hell || undefined}
      className={cn('motion-safe:transition-colors motion-safe:duration-300', hell && 'bg-primary/15 hover:bg-primary/15', className)}
    />
  )
}

/** Lässt den Inhalt kurz aufploppen, wenn sich `wert` ändert (z. B. Status von «Versendet» zu «Bezahlt»). */
export function Aufploppen({ wert, children, className, als = 'span' }: { wert: string; children: ReactNode; className?: string; als?: 'span' | 'div' }) {
  const vorher = useRef(wert)
  const [runde, setRunde] = useState(0)
  useEffect(() => {
    if (vorher.current !== wert) {
      vorher.current = wert
      setRunde(r => r + 1)
    }
  }, [wert])
  const Tag = als
  return (
    <Tag key={runde} className={cn(als === 'span' && 'inline-flex flex-wrap items-center gap-1.5', runde > 0 && 'motion-safe:animate-pop', className)}>
      {children}
    </Tag>
  )
}

/** Merkt sich die IDs einer Liste und liefert die seit der letzten Anzeige neu dazugekommenen. */
export function useNeueIds(ids: readonly string[]): Set<string> {
  const vorher = useRef<readonly string[] | null>(null)
  const neu = neueIds(vorher.current, ids)
  useEffect(() => { vorher.current = ids })
  return neu
}

/** Klassen für einen neu dazugekommenen Listeneintrag (blendet von oben ein). */
export const EINBLENDEN = 'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-300'

/**
 * Betrag, der bei einer Änderung in 300 ms vom alten zum neuen Wert zählt. Beim ersten Anzeigen
 * steht sofort der Endwert (kein Aufblitzen von 0 beim Laden).
 */
export function Zahl({ wert }: { wert: number }) {
  const [anzeige, setAnzeige] = useState(wert)
  // Zuletzt angezeigter Wert: ändert sich der Betrag mitten im Zählen, geht es von dort weiter (kein Sprung)
  const angezeigt = useRef(wert)
  useEffect(() => {
    const von = angezeigt.current
    if (von === wert) return
    const zeige = (n: number) => { angezeigt.current = n; setAnzeige(n) }
    if (bewegungReduziert()) { zeige(wert); return }
    const start = performance.now()
    let frame = 0
    const schritt = (t: number) => {
      const p = (t - start) / 300
      zeige(zwischenwert(von, wert, p))
      if (p < 1) frame = requestAnimationFrame(schritt)
    }
    frame = requestAnimationFrame(schritt)
    return () => cancelAnimationFrame(frame)
  }, [wert])
  return <>{formatBetrag(anzeige)}</>
}
