'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import NavLinks, { NavFooterLinks, type NavCustomer } from './NavLinks'

/** Auf kleinen Bildschirmen: Menü-Knopf, der die Seitenleiste als Schublade von links öffnet. */
export default function MobileNav({ header, footer, customers = [] }: { header?: ReactNode; footer?: ReactNode; customers?: NavCustomer[] }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  useEffect(() => setOpen(false), [pathname])

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Menü öffnen" onClick={() => setOpen(true)}>
        <Menu className="h-5 w-5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="left-0! top-0! flex h-full w-72 max-w-[85vw] translate-x-0! translate-y-0! flex-col gap-6 overflow-y-auto rounded-none border-0 border-r p-4 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 sm:rounded-none">
          <DialogTitle className="sr-only">Menü</DialogTitle>
          <DialogDescription className="sr-only">Navigation des Admin-Bereichs</DialogDescription>
          <div className="pt-1">{header}</div>
          <NavLinks onNavigate={() => setOpen(false)} customers={customers} />
          <div className="mt-auto space-y-3 border-t pt-4">
            <NavFooterLinks onNavigate={() => setOpen(false)} />
            {footer}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
