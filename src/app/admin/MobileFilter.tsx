'use client'
import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Filterleiste: auf dem Handy hinter einem Knopf „Filter“ mit Kurzfassung der Auswahl
 * (spart einen halben Bildschirm), ab Tablet-Breite immer offen.
 */
export default function MobileFilter({ zusammenfassung, children }: { zusammenfassung: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 rounded-md border border-input px-3 py-2 text-left text-sm transition-colors hover:bg-slate-700/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
      >
        <SlidersHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="font-medium">Filter</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{zusammenfassung}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {/* Auf- und Zuklappen über die Grid-Zeilenhöhe (0fr ↔ 1fr); geschlossen unsichtbar, also nicht fokussierbar */}
      <div
        id={id}
        className={cn(
          'grid transition-[grid-template-rows,margin-top,visibility] duration-250 ease-out motion-reduce:transition-none',
          open ? 'visible mt-3 grid-rows-[1fr]' : 'invisible mt-0 grid-rows-[0fr]',
          'sm:visible sm:mt-0 sm:grid-rows-[1fr]',
        )}
      >
        {/* p-1/-m-1: Platz für Fokusrahmen trotz overflow-hidden */}
        <div className="-m-1 min-h-0 overflow-hidden p-1 sm:m-0 sm:overflow-visible sm:p-0">{children}</div>
      </div>
    </div>
  )
}
