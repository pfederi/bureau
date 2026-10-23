'use client'
import { useState } from 'react'
import { useNavRouter } from '@/app/admin/NavProgress'
import { Clock, Link2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import type { Customer } from '@/lib/types'
import type { SentTimeReport } from '@/lib/db/timeReport'
import { CustomerFormDialog, CustomerDeleteDialog } from '../../CustomerDialogs'
import PortalLinkDialog from './PortalLinkDialog'
import TimeReportDialog, { type ReportMonth } from './TimeReportDialog'

/** Bearbeiten, Löschen, Stundenrapport und Kundenlink direkt im Kunden-Dashboard. */
export default function CustomerHeaderActions({ customer, reportMonths, defaultReportMonth, sentReports }: {
  customer: Customer
  reportMonths: ReportMonth[]
  defaultReportMonth: string | null
  sentReports: SentTimeReport[]
}) {
  const router = useNavRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [portalOpen, setPortalOpen] = useState(false)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label={`Aktionen für ${customer.firma_oder_name}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* setTimeout: Dropdown erst schliessen lassen (Dialog-in-Dropdown-Bug) */}
          <DropdownMenuItem onSelect={() => setTimeout(() => setEditOpen(true), 0)}>
            <Pencil className="h-4 w-4 mr-2" />Bearbeiten
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTimeout(() => setReportOpen(true), 0)}>
            <Clock className="h-4 w-4 mr-2" />Stundenrapport…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTimeout(() => setPortalOpen(true), 0)}>
            <Link2 className="h-4 w-4 mr-2" />Kundenlink…{customer.portal_token && <span className="ml-2 text-xs text-muted-foreground">aktiv</span>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setTimeout(() => setDeleteOpen(true), 0)}>
            <Trash2 className="h-4 w-4 mr-2" />Kunde löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <TimeReportDialog
        customer={customer} months={reportMonths} defaultMonth={defaultReportMonth} sent={sentReports}
        open={reportOpen} onOpenChange={setReportOpen}
      />
      <PortalLinkDialog customer={customer} open={portalOpen} onOpenChange={setPortalOpen} />
      <CustomerFormDialog open={editOpen} editing={editOpen ? customer : null} onClose={() => setEditOpen(false)} />
      <CustomerDeleteDialog
        target={deleteOpen ? customer : null}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => router.push('/admin/kunden')}
      />
    </>
  )
}
