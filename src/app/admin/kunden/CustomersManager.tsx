'use client'
import { useState, type MouseEvent } from 'react'
import { useNavRouter } from '@/app/admin/NavProgress'
import { UserPlus, Pencil, Trash2, Wallet, MoreHorizontal } from 'lucide-react'
import { CustomerFormDialog, CustomerDeleteDialog } from './CustomerDialogs'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import type { Customer } from '@/lib/types'
import { hasHosting } from '@/lib/invoices/hosting'
import { formatChf } from '@/lib/invoices/stats'
import StickyHeader from '../StickyHeader'

export function CustomersManager({ customers }: { customers: Customer[] }) {
  const [editing, setEditing] = useState<Customer | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const router = useNavRouter()

  function openKonto(e: MouseEvent<HTMLTableRowElement>, c: Customer) {
    const target = e.target as HTMLElement
    // Klicks auf Knöpfe/Links ignorieren, ebenso Klicks aus dem Kontextmenü: Es liegt in
    // einem Portal ausserhalb der Zeile, React reicht das Event aber trotzdem hoch.
    if (!e.currentTarget.contains(target) || target.closest('a, button')) return
    router.push(`/admin/kunden/${c.id}/konto`)
  }

  function startNew() {
    setEditing(null)
    setFormOpen(true)
  }

  function startEdit(c: Customer) {
    setEditing(c)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
  }

  return (
    <div className="space-y-6">
      <StickyHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Kunden</h1>
            <p className="text-sm text-muted-foreground">Kunden verwalten, bearbeiten und neue anlegen.</p>
          </div>
          <Button onClick={startNew}><UserPlus className="h-4 w-4 mr-1.5" />Neuer Kunde</Button>
        </div>
      </StickyHeader>

      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell">Nr.</TableHead>
                <TableHead>Firma / Name</TableHead>
                <TableHead className="hidden md:table-cell">Ort</TableHead>
                <TableHead className="hidden lg:table-cell">E-Mail</TableHead>
                <TableHead className="hidden lg:table-cell">Hosting</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map(c => (
                <TableRow
                  key={c.id}
                  data-state={editing?.id === c.id ? 'selected' : undefined}
                  className="cursor-pointer"
                  onClick={e => openKonto(e, c)}
                >
                  <TableCell className="hidden sm:table-cell">{c.kundennummer}</TableCell>
                  <TableCell>
                    <span className="block whitespace-nowrap">{c.firma_oder_name}</span>
                    {/* Kleinere Breiten: Ort und E-Mail als zweite Zeile */}
                    <span className="block text-xs text-muted-foreground lg:hidden">
                      {c.ort && <span className="md:hidden">{c.ort}{c.email ? ' · ' : ''}</span>}
                      {c.email}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{c.ort}</TableCell>
                  <TableCell className="hidden lg:table-cell">{c.email}</TableCell>
                  <TableCell className="hidden tabular-nums text-muted-foreground lg:table-cell">
                    {hasHosting(c) ? `${formatChf(Number(c.hosting_preis_monat))} / Mt.` : '–'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <a href={`/admin/kunden/${c.id}/konto`}><Wallet className="h-4 w-4 sm:mr-1.5" /><span className="sr-only sm:not-sr-only">Konto</span></a>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Aktionen für ${c.firma_oder_name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {/* setTimeout: Dropdown erst schliessen lassen, sonst bleibt body auf pointer-events:none (Dialog-in-Dropdown-Bug). */}
                          <DropdownMenuItem onSelect={() => setTimeout(() => startEdit(c), 0)}>
                            <Pencil className="h-4 w-4 mr-2" />Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setTimeout(() => setDeleteTarget(c), 0)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {customers.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Noch keine Kunden.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CustomerFormDialog open={formOpen} editing={editing} onClose={closeForm} />
      <CustomerDeleteDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => { if (editing?.id === deleteTarget?.id) setEditing(null) }}
      />
    </div>
  )
}
