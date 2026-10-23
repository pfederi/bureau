'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn, SIDEBAR_COOKIE } from '@/lib/utils'
import { edition } from '@/edition'
import NavLinks, { NavFooterLinks, type NavCustomer } from './NavLinks'
import { SearchButton } from './SearchCommand'

/** Unter dieser Fensterbreite wird die Seitenleiste automatisch schmal, damit der Inhalt Platz hat. */
const AUTO_NARROW_QUERY = '(max-width: 1279px)'

/**
 * Seitenleiste ab Desktop-Breite, umschaltbar zwischen breit (mit Beschriftung)
 * und schmal (nur Icons). Die Wahl steht im Cookie, damit der Server gleich richtig rendert.
 * In schmalen Fenstern ist sie automatisch schmal; der Schalter klappt sie dann nur vorübergehend auf.
 */
export default function DesktopSidebar({ initialCollapsed, name, email, version, signOut, customers, children }: {
  initialCollapsed: boolean
  name: string
  email: string
  version: string
  signOut: () => Promise<void>
  customers: NavCustomer[]
  children: ReactNode
}) {
  const [userCollapsed, setUserCollapsed] = useState(initialCollapsed)
  const [narrowWindow, setNarrowWindow] = useState(false)
  const [forceWide, setForceWide] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(AUTO_NARROW_QUERY)
    const update = () => { setNarrowWindow(mq.matches); if (!mq.matches) setForceWide(false) }
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const collapsed = userCollapsed || (narrowWindow && !forceWide)

  function toggle() {
    if (narrowWindow && !userCollapsed) {
      // Automatisch schmal: nur vorübergehend aufklappen, gespeicherte Wahl bleibt
      setForceWide(!forceWide)
      return
    }
    const next = !userCollapsed
    setUserCollapsed(next)
    document.cookie = `${SIDEBAR_COOKIE}=${next ? 'schmal' : 'breit'}; path=/admin; max-age=31536000; samesite=lax`
  }

  const itemBase = 'flex w-full items-center gap-3 rounded-md py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700/60 hover:text-blue-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col gap-5 overflow-y-auto overflow-x-hidden border-r bg-card py-4 transition-[width] duration-200 lg:flex',
          collapsed ? 'w-16 px-2' : 'w-60 px-3',
        )}
      >
        {/* Oben: Icon mit Benutzername */}
        <div className={cn('flex min-w-0 items-center gap-3', collapsed ? 'justify-center' : 'px-1')} title={collapsed ? `${name} · ${email}` : undefined}>
          <a href="/admin" aria-label="Dashboard" className="inline-flex shrink-0 rounded-md ring-1 ring-slate-600 hover:ring-blue-300">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={edition.logo} alt={edition.name} width={28} height={28} className="h-7 w-7 rounded-md" />
          </a>
          <div className={cn('min-w-0', collapsed && 'sr-only')}>
            <div className="truncate text-sm font-medium">{name}</div>
            {email && <div className="truncate text-xs text-muted-foreground">{email}</div>}
          </div>
        </div>
        <SearchButton wide collapsed={collapsed} />
        <NavLinks collapsed={collapsed} customers={customers} />

        <div className="mt-auto space-y-2 border-t pt-4">
          <NavFooterLinks collapsed={collapsed} />
          <form action={signOut}>
            <button type="submit" title={collapsed ? 'Abmelden' : undefined} className={cn(itemBase, collapsed ? 'justify-center px-2' : 'px-3')}>
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              <span className={collapsed ? 'sr-only' : undefined}>Abmelden</span>
            </button>
          </form>
          <div className="space-y-1 border-t pt-2">
            <button
              type="button"
              onClick={toggle}
              aria-expanded={!collapsed}
              title={collapsed ? 'Seitenleiste breit' : undefined}
              className={cn(itemBase, collapsed ? 'justify-center px-2' : 'px-3')}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden /> : <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden />}
              <span className={collapsed ? 'sr-only' : undefined}>{collapsed ? 'Seitenleiste breit' : 'Seitenleiste schmal'}</span>
            </button>
            {edition.releaseNotes ? (
              <a
                href="/admin/release-notes"
                title={collapsed ? `Version ${version} · Release Notes` : undefined}
                className={cn('block rounded-md py-1 text-xs text-muted-foreground hover:text-blue-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring', collapsed ? 'text-center' : 'px-3')}
              >
                {collapsed ? <>v{version}<span className="sr-only"> · Release Notes</span></> : <>Version {version} · Release Notes</>}
              </a>
            ) : (
              <p className={cn('py-1 text-xs text-muted-foreground', collapsed ? 'text-center' : 'px-3')}>
                {collapsed ? <>v{version}</> : <>Version {version}</>}
              </p>
            )}
          </div>
        </div>
      </aside>
      <div className={cn('flex min-h-screen flex-col transition-[padding] duration-200', collapsed ? 'lg:pl-16' : 'lg:pl-60')}>
        {children}
      </div>
    </>
  )
}
