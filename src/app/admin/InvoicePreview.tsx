'use client'
import { useState, type ReactNode } from 'react'
import { Download, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/** PDF-Vorschau einer Rechnung im Dialog, mit „In neuem Tab“ und „Herunterladen“. */
export function InvoicePreviewDialog({ id, rechnungsnummer, open, onOpenChange }: {
  id: string
  rechnungsnummer: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const pdfUrl = `/api/invoices/${id}/pdf`
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Vorschau {rechnungsnummer}</DialogTitle>
          <DialogDescription>So sieht die Rechnung als PDF aus.</DialogDescription>
        </DialogHeader>
        {open && (
          <iframe
            src={`${pdfUrl}?inline=1`}
            title={`Vorschau ${rechnungsnummer}`}
            className="h-[70vh] w-full rounded-md border bg-muted"
          />
        )}
        <div className="flex justify-end gap-2">
          <Button asChild variant="ghost">
            <a href={`${pdfUrl}?inline=1`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />In neuem Tab
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={pdfUrl}><Download className="h-4 w-4 mr-2" />Herunterladen</a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Knopf (z. B. die Rechnungsnummer), der die PDF-Vorschau öffnet. */
export function InvoicePreviewButton({ id, rechnungsnummer, className, children, label }: {
  id: string
  rechnungsnummer: string
  className?: string
  children: ReactNode
  /** Zugänglicher Name, falls der Inhalt nur ein Symbol ist */
  label?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label ?? 'PDF-Vorschau öffnen'}
        // in <summary>: nur die Vorschau öffnen, nicht auf-/zuklappen
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(true) }}
        className={cn('rounded-sm text-left underline-offset-4 hover:text-blue-300 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring', className)}
      >
        {children}
      </button>
      <InvoicePreviewDialog id={id} rechnungsnummer={rechnungsnummer} open={open} onOpenChange={setOpen} />
    </>
  )
}
