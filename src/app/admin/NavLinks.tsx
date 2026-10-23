'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Receipt, Users, Clock, Settings, LayoutGrid, FileText, Coins, BookOpen, ChevronRight, type LucideIcon,
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
    ],
  },
  ...(edition.website ? [{ title: 'Website', items: [{ href: '/admin/projekte', label: 'Projekte', icon: LayoutGrid }] }] : []),
]

const FOOTER_ITEMS: Item[] = [
  { href: '/admin/einstellungen', label: 'Einstellungen', icon: Settings },
  { href: '/admin/anleitung', label: 'Anleitung', icon: BookOpen },
]

function NavItem({ item, onNavigate, collapsed = false }: { item: Item; onNavigate?: () => void; collapsed?: boolean }) {
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
      title={collapsed ? item.label : undefined}
      className={cn(
        'flex items-center gap-3 rounded-md py-2 text-sm transition-colors',
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
  if (collapsed || customers.length === 0) return <NavItem item={item} onNavigate={onNavigate} collapsed={collapsed} />

  return (
    <>
      <div className="flex items-center gap-0.5">
        <div className="min-w-0 flex-1"><NavItem item={item} onNavigate={onNavigate} /></div>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls="nav-kunden"
          aria-label={open ? 'Kundenliste zuklappen' : 'Kundenliste aufklappen'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-slate-700/60 hover:text-blue-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className={cn('h-4 w-4 transition-transform', open && 'rotate-90')} aria-hidden />
        </button>
      </div>
      <ul id="nav-kunden" hidden={!open} className="ml-5 mt-0.5 space-y-0.5 border-l border-slate-700 pl-2">
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
    </>
  )
}

/** Hauptnavigation der Seitenleiste, in Gruppen. */
export default function NavLinks({ onNavigate, collapsed = false, customers = [] }: {
  onNavigate?: () => void
  collapsed?: boolean
  customers?: NavCustomer[]
}) {
  return (
    <nav aria-label="Hauptnavigation" className={collapsed ? 'space-y-3' : 'space-y-5'}>
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
                  : <NavItem item={item} onNavigate={onNavigate} collapsed={collapsed} />}
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
