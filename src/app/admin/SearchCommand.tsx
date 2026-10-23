'use client'
import { useEffect, useRef, useState } from 'react'
import { useNavRouter } from '@/app/admin/NavProgress'
import { Search } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { SearchHit } from '@/lib/db/search'
import { searchAction } from './searchActions'

const OPEN_EVENT = 'admin-search-open'

/** Knopf, der die globale Suche öffnet (beliebig oft platzierbar; der Dialog existiert nur einmal). */
export function SearchButton({ wide = false, collapsed = false }: { wide?: boolean; collapsed?: boolean }) {
  const full = wide && !collapsed
  return (
    <button
      type="button"
      title="Suchen (⌘K oder /)"
      aria-label={full ? undefined : 'Suchen'}
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      className={cn(
        'inline-flex items-center gap-2 rounded-md border text-sm text-slate-300 hover:bg-slate-700/60 hover:text-blue-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
        full ? 'w-full px-3 py-2' : wide ? 'w-full justify-center py-2' : 'px-2.5 py-1.5',
      )}
    >
      <Search className="h-4 w-4" aria-hidden />
      {full && <>
        <span className="flex-1 text-left">Suchen</span>
        <kbd className="rounded bg-slate-700 px-1.5 py-0.5 font-sans text-[10px] text-slate-300">⌘K</kbd>
      </>}
    </button>
  )
}

/** Globale Suche (⌘K / Ctrl+K oder /) über Kunden, Rechnungen, Offerten, Zeiteinträge und Projekte. */
export default function SearchCommand() {
  const router = useNavRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(false)
  const request = useRef(0)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
        return
      }
      // «/» öffnet die Suche – ausser beim Tippen in einem Eingabefeld.
      const t = e.target as HTMLElement | null
      const typing = !!t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !typing) {
        e.preventDefault()
        setOpen(true)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_EVENT, onOpen)
    }
  }, [])

  // Leicht verzögert suchen; ältere Antworten verwerfen, wenn schon weitergetippt wurde.
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return }
    const id = ++request.current
    setLoading(true)
    const t = setTimeout(async () => {
      const result = await searchAction(q)
      if (id !== request.current) return
      setHits(result)
      setActive(0)
      setLoading(false)
    }, 200)
    return () => clearTimeout(t)
  }, [q])

  function go(hit: SearchHit | undefined) {
    if (!hit) return
    setOpen(false)
    setQ('')
    router.push(hit.href)
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, hits.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); go(hits[active]) }
  }

  const groups = Array.from(new Set(hits.map(h => h.group)))

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[15%] translate-y-0 gap-0 p-0 sm:max-w-2xl">
          <DialogTitle className="sr-only">Suchen</DialogTitle>
          <DialogDescription className="sr-only">Kunden, Rechnungen, Offerten, Zeiteinträge und Projekte durchsuchen.</DialogDescription>
          <div className="flex items-center gap-2 border-b px-4 focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={onInputKey}
              aria-label="Suchbegriff"
              placeholder="Kunde, Rechnungsnummer, Beschreibung …"
              className="h-12 w-full bg-transparent text-sm outline-hidden placeholder:text-muted-foreground"
            />
          </div>
          <p className="sr-only" aria-live="polite">
            {q.trim().length >= 2 && !loading ? `${hits.length} ${hits.length === 1 ? 'Treffer' : 'Treffer'}` : ''}
          </p>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {q.trim().length < 2 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">Mindestens 2 Zeichen eingeben.</p>}
            {q.trim().length >= 2 && !loading && hits.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">Keine Treffer.</p>
            )}
            {groups.map(g => (
              <div key={g} className="mb-2">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">{g}</div>
                {hits.filter(h => h.group === g).map(h => {
                  const index = hits.indexOf(h)
                  return (
                    <button
                      key={`${h.group}-${h.id}`}
                      type="button"
                      onMouseEnter={() => setActive(index)}
                      onClick={() => go(h)}
                      className={cn('block w-full rounded-md px-2 py-1.5 text-left', index === active && 'bg-accent text-accent-foreground')}
                    >
                      <span className="block truncate text-sm">{h.title}</span>
                      {h.subtitle && <span className="block truncate text-xs text-muted-foreground">{h.subtitle}</span>}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
