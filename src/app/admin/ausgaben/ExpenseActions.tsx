'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { Expense } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { ExpenseDialog } from './ExpenseDialog'
import { deleteExpenseAction } from './actions'

export default function ExpenseActions({ expense, today }: { expense: Expense; today: string }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  async function remove() {
    const r = await deleteExpenseAction(expense.id)
    if (!r.ok) { toast.error(r.error ?? 'Löschen fehlgeschlagen.'); return }
    toast.success('Ausgabe gelöscht')
    setDeleteOpen(false)
    router.refresh()
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Aktionen für ${expense.beschreibung}`}><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* setTimeout: Dropdown erst schliessen lassen (Dialog-in-Dropdown-Bug) */}
          <DropdownMenuItem onSelect={() => setTimeout(() => setEditOpen(true), 0)}><Pencil className="h-4 w-4 mr-2" />Bearbeiten</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setTimeout(() => setDeleteOpen(true), 0)}>
            <Trash2 className="h-4 w-4 mr-2" />Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ExpenseDialog open={editOpen} onOpenChange={setEditOpen} expense={expense} today={today} />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>„{expense.beschreibung}“ löschen?</AlertDialogTitle>
            <AlertDialogDescription>Die Ausgabe und ihr Beleg werden endgültig gelöscht.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={remove}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
