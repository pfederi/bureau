'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Seitenkopf (Titel, Knöpfe, Filter), der ab Desktop-Breite beim Scrollen oben bleibt.
 * Sitzt er fest, wird er kompakt (kleinerer Titel, ohne Untertitel; siehe .sticky-kopf
 * in globals.css). Auf dem Handy scrollt er normal mit – dort ist die Menüleiste fixiert.
 */
export default function StickyHeader({ children, className }: { children: ReactNode; className?: string }) {
  const sentinel = useRef<HTMLDivElement>(null)
  const kopf = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)

  // Höhe als CSS-Variable: Tabellenköpfe kleben direkt darunter (globals.css)
  useEffect(() => {
    const el = kopf.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const root = document.documentElement
    const update = () => root.style.setProperty('--sticky-kopf-h', `${el.offsetHeight}px`)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => { ro.disconnect(); root.style.removeProperty('--sticky-kopf-h') }
  }, [])

  useEffect(() => {
    const el = sentinel.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <>
      <div ref={sentinel} aria-hidden className="h-px -mb-px" />
      <div
        ref={kopf}
        data-stuck={stuck}
        className={cn(
          // mt-6: Abstand nach dem Sentinel wie im space-y-6 der Seite (Tailwind 4 setzt ihn sonst nicht)
          'sticky-kopf z-30 mt-6 space-y-4 bg-background',
          'lg:sticky lg:top-0 lg:-mx-10 lg:border-b lg:border-transparent lg:px-10 lg:py-3 lg:transition-colors',
          'lg:data-[stuck=true]:border-border lg:data-[stuck=true]:shadow-[0_8px_16px_-12px_rgba(0,0,0,0.6)]',
          className,
        )}
      >
        {children}
      </div>
    </>
  )
}
