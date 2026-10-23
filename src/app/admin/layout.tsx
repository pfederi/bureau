import type { Metadata } from 'next'
import { edition } from '@/edition'
import { redirect } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createServerSupabase } from '@/lib/supabase/server'
import { getAdminStep } from '@/lib/auth'
import { Toaster } from '@/components/ui/sonner'
import { Sora } from 'next/font/google'
import MobileNav from './MobileNav'
import DesktopSidebar from './DesktopSidebar'
import { cookies } from 'next/headers'
import { getSettings } from '@/lib/db/settings'
import { listCustomers } from '@/lib/db/customers'
import { displayFirstName, SIDEBAR_COOKIE } from '@/lib/utils'
import BodyClass from './BodyClass'
import SearchCommand, { SearchButton } from './SearchCommand'
import NavProgress from './NavProgress'
import SitzungsWaechter from './SitzungsWaechter'
import { Suspense } from 'react'
import pkg from '../../../package.json'

// Schrift der Website (dort nur 300); für Tabellen und Zahlen zusätzlich 400–600.
const sora = Sora({ subsets: ['latin'], weight: ['300', '400', '500', '600'] })

export const metadata: Metadata = {
  title: { default: 'Admin', template: `%s · ${edition.adminTitel}` },
}

async function signOut() {
  'use server'
  const supabase = await createServerSupabase()
  await supabase.auth.signOut()
  redirect('/admin/login')
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase()
  const { step, user } = await getAdminStep(supabase)

  // Login, Code-Eingabe und 2FA-Einrichtung ohne Seitenleiste
  if (step !== 'ok' || !user) {
    return <div lang="de" className={`admin-dark ${sora.className} min-h-screen bg-background text-foreground`}>{children}<Toaster /><BodyClass className={`admin-dark ${sora.className}`} /></div>
  }

  const [settings, allCustomers] = await Promise.all([getSettings().catch(() => null), listCustomers().catch(() => [])])
  // Direktzugang in der Seitenleiste, alphabetisch
  const customers = allCustomers
    .map(c => ({ id: c.id, name: c.firma_oder_name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))

  const name = displayFirstName(user.user_metadata, settings?.absender_name, user.email)
  const logo = (
    <a href="/admin" aria-label="Dashboard" className="inline-flex shrink-0 rounded-md ring-1 ring-slate-600 hover:ring-blue-300">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={edition.logo} alt={edition.name} width={28} height={28} className="h-7 w-7 rounded-md" />
    </a>
  )
  const email = user.email ?? ''
  // Oben: Icon mit Benutzername; unten: Abmelden (Seitenleiste und Handy-Schublade)
  const identity = (
    <div className="flex min-w-0 items-center gap-3 px-1">
      {logo}
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{name}</div>
        {email && <div className="truncate text-xs text-muted-foreground">{email}</div>}
      </div>
    </div>
  )
  const logout = (
    <form action={signOut}>
      <button type="submit" className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700/60 hover:text-blue-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
        <LogOut className="h-4 w-4 shrink-0" aria-hidden />Abmelden
      </button>
    </form>
  )

  const version = (
    <div className="border-t pt-2">
      {edition.releaseNotes ? (
        <a href="/admin/release-notes" className="block rounded-md px-3 py-1 text-xs text-muted-foreground hover:text-blue-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
          Version {pkg.version} · Release Notes
        </a>
      ) : (
        <p className="px-3 py-1 text-xs text-muted-foreground">Version {pkg.version}</p>
      )}
    </div>
  )

  return (
    <div lang="de" className={`admin-dark ${sora.className} min-h-screen bg-background text-foreground`}>
      <a href="#inhalt" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground">Zum Inhalt springen</a>

      <DesktopSidebar
        initialCollapsed={(await cookies()).get(SIDEBAR_COOKIE)?.value === 'schmal'}
        name={name}
        email={email}
        version={pkg.version}
        signOut={signOut}
        customers={customers}
      >
        {/* Kopfzeile auf kleinen Bildschirmen */}
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b bg-card px-4 py-3 lg:hidden">
          <MobileNav header={identity} footer={<>{logout}{version}</>} customers={customers} />
          {logo}
          <div className="ml-auto">
            <SearchButton />
          </div>
        </header>
        <main id="inhalt" tabIndex={-1} className="flex-1 bg-background outline-hidden">
          <div className="max-w-(--breakpoint-2xl) px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</div>
        </main>
      </DesktopSidebar>
      <SearchCommand />
      <Suspense fallback={null}><NavProgress /></Suspense>
      <SitzungsWaechter />
      <Toaster /><BodyClass className={`admin-dark ${sora.className}`} />
    </div>
  )
}
