'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Receipt, Users, Clock, Settings, LayoutGrid, FileText, Coins, ChartColumn, BookOpen, ChevronRight, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { edition } from '@/edition'

type Item = { href: string; label: string; icon: LucideIcon }

/** Kunde für den Direktzugang in der Seitenleiste */
export type NavCustomer = { id: string; name: string }

const CUSTOMERS_KEY = 'admin-nav-kunden'

// Gruppen der Seitenleiste; Projekte gehören zur Website, nicht zur Rechnungserfassung.
const GROUPS: { title?: string; items: Item[] }[] = [
  { items: [{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    title: 'Arbeit',
    items: [
      { href: '/admin/zeiterfassung', label: 'Zeiterfassung', icon: Clock },
      { href: '/admin/kunden', label: 'Kunden', icon: Users },
    ],
  },
  {
    title: 'Finanzen',
    items: [
      { href: '/admin/rechnungen', label: 'Rechnungen', icon: Receipt },
      { href: '/admin/offerten', label: 'Offerten', icon: FileText },
      { href: '/admin/ausgaben', label: 'Ausgaben', icon: Coins },
      { href: '/admin/auswertung', label: 'Auswertung', icon: ChartColumn },
    ],
  },
  ...(edition.website ? [{ title: 'Website', items: [{ href: '/admin/projekte', label: 'Projekte', icon: LayoutGrid }] }] : []),
]

const FOOTER_ITEMS: Item[] = [
  { href: '/admin/einstellungen', label: 'Einstellungen', icon: Settings },
  { href: '/admin/anleitung', label: 'Anleitung', icon: BookOpen },
]

function NavItem({ item, onNavigate, collapsed = false, haupt = false }: { item: Item; onNavigate?: () => void; collapsed?: boolean; haupt?: boolean }) {
  const pathname = usePathname()
  const active = item.href === '/admin' ? pathname === '/admin'
    // In einem Kunden-Dashboard ist der Kunde in der Liste markiert, nicht „Kunden“
    : item.href === '/admin/kunden' ? pathname === item.href
    : pathname.startsWith(item.href)
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      data-nav-haupt={haupt || undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        'relative flex items-center gap-3 rounded-md py-2 text-sm transition-colors',
        collapsed ? 'justify-center px-2' : 'px-3',
        // Website-Blau für Hover/Aktiv; inaktiv hell genug für Kontrast auf slate-800.
        active ? 'bg-slate-700 font-medium text-blue-300' : 'text-slate-300 hover:bg-slate-700/60 hover:text-blue-300',
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" aria-hidden />
      {/* Schmal: Beschriftung nur für Screenreader */}
      <span className={collapsed ? 'sr-only' : undefined}>{item.label}</span>
    </Link>
  )
}

/** „Kunden“ mit aufklappbarer Liste: direkt ins Kunden-Dashboard. */
function CustomersItem({ item, customers, onNavigate, collapsed }: {
  item: Item; customers: NavCustomer[]; onNavigate?: () => void; collapsed: boolean
}) {
  const pathname = usePathname()
  const imBereich = pathname.startsWith('/admin/kunden/')
  const [open, setOpen] = useState(false)

  // Zuletzt gewählter Zustand pro Browser; in einem Kunden-Dashboard immer offen
  useEffect(() => {
    try { setOpen(localStorage.getItem(CUSTOMERS_KEY) === 'offen') } catch { /* ohne Speicher zu */ }
  }, [])
  useEffect(() => { if (imBereich) setOpen(true) }, [imBereich])

  function toggle() {
    const next = !open
    setOpen(next)
    try { localStorage.setItem(CUSTOMERS_KEY, next ? 'offen' : 'zu') } catch { /* egal */ }
  }

  // Schmale Leiste: kein Platz für Namen, nur der Link zur Kundenliste
  if (collapsed || customers.length === 0) return <NavItem item={item} onNavigate={onNavigate} collapsed={collapsed} haupt />

  return (
    <>
      <div className="flex items-center gap-0.5">
        <div className="min-w-0 flex-1"><NavItem item={item} onNavigate={onNavigate} haupt /></div>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls="nav-kunden"
          aria-label={open ? 'Kundenliste zuklappen' : 'Kundenliste aufklappen'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-slate-700/60 hover:text-blue-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className={cn('h-4 w-4 motion-safe:transition-transform motion-safe:duration-250', open && 'rotate-90')} aria-hidden />
        </button>
      </div>
      {/* Gleitet über grid-template-rows auf und zu; zugeklappt inert (nicht fokussierbar, nicht vorgelesen) */}
      <div
        id="nav-kunden"
        inert={!open}
        className={cn(
          'grid motion-safe:transition-[grid-template-rows] motion-safe:duration-250 motion-safe:ease-[cubic-bezier(0.2,0.8,0.2,1)]',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
      <div className="min-h-0 overflow-hidden">
      <ul className="ml-5 mt-0.5 space-y-0.5 border-l border-slate-700 pl-2">
        {customers.map(c => {
          const href = `/admin/kunden/${c.id}/konto`
          const active = pathname.startsWith(`/admin/kunden/${c.id}`)
          return (
            <li key={c.id}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                title={c.name}
                className={cn(
                  'block truncate rounded-md px-3 py-1.5 text-sm transition-colors',
                  active ? 'bg-slate-700 font-medium text-blue-300' : 'text-slate-300 hover:bg-slate-700/60 hover:text-blue-300',
                )}
              >
                {c.name}
              </Link>
            </li>
          )
        })}
      </ul>
      </div>
      </div>
    </>
  )
}

/** Hauptnavigation der Seitenleiste, in Gruppen. */
export default function NavLinks({ onNavigate, collapsed = false, customers = [] }: {
  onNavigate?: () => void
  collapsed?: boolean
  customers?: NavCustomer[]
}) {
  // Gleitender Hintergrund des aktiven Punkts: misst den aktiven Link und folgt ihm beim Seitenwechsel
  const navRef = useRef<HTMLElement>(null)
  const pathname = usePathname()
  const [pos, setPos] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const messen = () => {
      const el = nav.querySelector<HTMLElement>('[data-nav-haupt][aria-current="page"]')
      if (!el) { setPos(null); return }
      const n = nav.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      setPos({ top: r.top - n.top, left: r.left - n.left, width: r.width, height: r.height })
    }
    messen()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(messen)
    ro.observe(nav)
    return () => ro.disconnect()
  }, [pathname, collapsed])

  return (
    <nav ref={navRef} aria-label="Hauptnavigation" data-indikator={pos ? 'an' : undefined} className={cn('relative', collapsed ? 'space-y-3' : 'space-y-5')}>
      <span
        aria-hidden
        className="pointer-events-none absolute rounded-md bg-slate-700 motion-safe:transition-[top,left,width,height] motion-safe:duration-250 motion-safe:ease-[cubic-bezier(0.2,0.8,0.2,1)]"
        style={pos ?? { display: 'none' }}
      />
      {GROUPS.map((g, i) => (
        <div key={i} className={cn(collapsed && i > 0 && 'border-t pt-3')}>
          {g.title && (
            <div className={cn('mb-1 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground', collapsed && 'sr-only')}>{g.title}</div>
          )}
          <ul className="space-y-0.5">
            {g.items.map(item => (
              <li key={item.href}>
                {item.href === '/admin/kunden'
                  ? <CustomersItem item={item} customers={customers} onNavigate={onNavigate} collapsed={collapsed} />
                  : <NavItem item={item} onNavigate={onNavigate} collapsed={collapsed} haupt />}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/** Einstellungen und Anleitung am Fuss der Seitenleiste. */
export function NavFooterLinks({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  return (
    <ul className="space-y-0.5" aria-label="Weitere Seiten">
      {FOOTER_ITEMS.map(item => <li key={item.href}><NavItem item={item} onNavigate={onNavigate} collapsed={collapsed} /></li>)}
    </ul>
  )
}
