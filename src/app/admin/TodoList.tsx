'use client'
import { useEffect, useRef, useState } from 'react'
import { BellRing, CalendarClock, Clock, FilePen, FileText, Gauge, Globe, Server, type LucideIcon } from 'lucide-react'
import { formatChf } from '@/lib/invoices/stats'
import { cn } from '@/lib/utils'
import type { Todo, TodoArt } from '@/lib/dashboard/todos'
import RemindButton from './RemindButton'
import AlarmPunkt from './AlarmPunkt'

const ICON: Record<TodoArt, LucideIcon> = {
  erinnern: BellRing, offerte: FileText, entwurf: FilePen, stunden: Clock, beleg: CalendarClock, hosting: Server, budget: Gauge, website: Globe,
}
const DAUER = 300

type Eintrag = { todo: Todo; zustand: 'da' | 'neu' | 'weg' }

/**
 * Todo-Liste mit Bewegung: Erledigtes gleitet nach rechts weg und klappt zu, Neues blendet ein.
 * Beim ersten Anzeigen ruhig (keine Animation), nur bei Änderungen nach router.refresh().
 */
export default function TodoList({ todos }: { todos: Todo[] }) {
  const [liste, setListe] = useState<Eintrag[]>(() => todos.map(todo => ({ todo, zustand: 'da' })))
  const erster = useRef(true)

  useEffect(() => {
    if (erster.current) { erster.current = false; return }
    setListe(bisher => {
      const neueKeys = new Set(todos.map(t => t.key))
      const alteKeys = new Set(bisher.map(e => e.todo.key))
      const ergebnis: Eintrag[] = todos.map(todo => ({ todo, zustand: alteKeys.has(todo.key) ? 'da' : 'neu' }))
      // Weggefallene an ihrer bisherigen Stelle einfügen, damit sie dort ausgleiten
      bisher.forEach((e, i) => {
        if (!neueKeys.has(e.todo.key) && e.zustand !== 'weg') ergebnis.splice(Math.min(i, ergebnis.length), 0, { todo: e.todo, zustand: 'weg' })
      })
      return ergebnis
    })
    const t = setTimeout(() => setListe(l => l.filter(e => e.zustand !== 'weg')), DAUER + 50)
    return () => clearTimeout(t)
  }, [todos])

  return (
    <ul className="divide-y">
      {liste.map(({ todo: t, zustand }) => {
        const Icon = ICON[t.art]
        return (
          <li
            key={t.key}
            aria-hidden={zustand === 'weg' || undefined}
            className={cn(
              // overflow-hidden nur beim Wegklappen, sonst würden Fokusrahmen am Rand abgeschnitten
              'flex max-h-40 flex-wrap items-center gap-x-3 gap-y-2 py-2.5 first:pt-0 last:pb-0',
              'motion-safe:transition-[max-height,opacity,transform,padding] motion-safe:duration-300 motion-safe:ease-out',
              zustand === 'weg' && 'pointer-events-none max-h-0 translate-x-8 overflow-hidden py-0 opacity-0',
              zustand === 'neu' && 'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-2',
            )}
          >
            {t.art === 'website' && t.key.startsWith('website-')
              ? <span className="flex h-4 w-4 shrink-0 items-center justify-center"><AlarmPunkt /></span>
              : <Icon className={cn('h-4 w-4 shrink-0', t.dringend ? 'text-amber-400' : 'text-muted-foreground')} aria-hidden />}
            <a href={t.href} tabIndex={zustand === 'weg' ? -1 : undefined} className="min-w-0 flex-1 rounded-sm hover:text-blue-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
              <div className="line-clamp-2 text-sm sm:truncate">{t.titel}</div>
              <div className={cn('text-xs', t.dringend ? 'text-amber-400' : 'text-muted-foreground')}>
                {t.dringend && <span className="sr-only">Dringend: </span>}{t.detail}
              </div>
            </a>
            {t.betrag !== undefined && <span className="shrink-0 whitespace-nowrap text-sm tabular-nums">{formatChf(t.betrag)}</span>}
            {t.erinnern && zustand !== 'weg' && <RemindButton {...t.erinnern} />}
          </li>
        )
      })}
    </ul>
  )
}
