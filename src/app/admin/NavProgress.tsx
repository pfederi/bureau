'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

const START = 'admin-nav-start'

/** Ladebalken starten, z. B. vor einem router.push (Links erkennt NavProgress selbst). */
export function startNav() {
  window.dispatchEvent(new Event(START))
}

/** Wie useRouter, aber push startet den Ladebalken. */
export function useNavRouter() {
  const router = useRouter()
  return useMemo(() => ({
    ...router,
    push: (...args: Parameters<typeof router.push>) => { startNav(); router.push(...args) },
  }), [router])
}

/**
 * Dünner Ladebalken oben beim Seitenwechsel: Die Admin-Seiten laden ihre Daten auf dem Server,
 * ohne Rückmeldung wirkt ein Klick sonst kurz «tot». Start bei Klick auf einen internen Link
 * oder startNav(), Ende sobald sich Pfad oder Suchparameter ändern.
 */
export default function NavProgress() {
  const pathname = usePathname()
  const params = useSearchParams()
  const [zustand, setZustand] = useState<'ruhe' | 'laden' | 'fertig'>('ruhe')

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a')
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
      const url = new URL(a.href, location.href)
      if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return
      if (url.pathname === location.pathname && url.search === location.search) return // nur Anker
      setZustand('laden')
    }
    const onStart = () => setZustand('laden')
    document.addEventListener('click', onClick, true)
    window.addEventListener(START, onStart)
    return () => { document.removeEventListener('click', onClick, true); window.removeEventListener(START, onStart) }
  }, [])

  // Neue Seite da: Balken voll laufen lassen und ausblenden
  const ziel = `${pathname}?${params.toString()}`
  const bisher = useRef(ziel)
  useEffect(() => {
    if (bisher.current === ziel) return
    bisher.current = ziel
    setZustand(z => (z === 'laden' ? 'fertig' : z))
  }, [ziel])

  useEffect(() => {
    if (zustand === 'ruhe') return
    // fertig: kurz voll zeigen; laden: Sicherheitsnetz, falls keine Navigation folgt
    const t = setTimeout(() => setZustand('ruhe'), zustand === 'fertig' ? 400 : 15000)
    return () => clearTimeout(t)
  }, [zustand])

  if (zustand === 'ruhe') return null
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5">
      <div
        className={cn(
          'h-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]',
          zustand === 'laden'
            ? 'w-[85%] motion-safe:animate-nav-laden motion-reduce:w-full motion-reduce:opacity-60'
            : 'w-full opacity-0 transition-opacity duration-300 delay-100',
        )}
      />
    </div>
  )
}
