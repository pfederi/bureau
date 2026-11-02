'use client'
import { useId, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Aufklappbarer Bereich in einer Card, standardmässig zu. Klappt über grid-template-rows
 * weich in beide Richtungen (auch in Safari/Firefox); zugeklappt ist der Inhalt inert.
 */
export default function Aufklapper({ titel, zusatz, children }: { titel: string; zusatz?: ReactNode; children: ReactNode }) {
  const [offen, setOffen] = useState(false)
  const id = useId()
  return (
    <>
      {/* karte-titel: klebt ab Desktop unter dem Seitenkopf (globals.css) */}
      <h2 className="karte-titel aufklapper-titel rounded-lg">
        <button
          type="button"
          aria-expanded={offen}
          aria-controls={id}
          onClick={() => setOffen(o => !o)}
          className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg p-4 text-left text-sm font-medium hover:bg-slate-700/30 sm:p-6 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className={cn('h-4 w-4 text-muted-foreground motion-safe:transition-transform motion-safe:duration-250', offen && 'rotate-90')} aria-hidden />
          {titel}
          {zusatz && <span className="font-normal tabular-nums text-muted-foreground">{zusatz}</span>}
        </button>
      </h2>
      <div
        id={id}
        inert={!offen}
        className={cn(
          'grid motion-safe:transition-[grid-template-rows] motion-safe:duration-250 motion-safe:ease-[cubic-bezier(0.2,0.8,0.2,1)]',
          offen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        {/* clip statt hidden: kein Scroll-Container, Tabellenköpfe können am Fenster kleben */}
        <div className="min-h-0 overflow-clip">{children}</div>
      </div>
    </>
  )
}
