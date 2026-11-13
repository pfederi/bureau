'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Save, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { DecimalInput } from '@/components/ui/decimal-input'
import { setProjectRateAction } from '../../rateActions'
import { OffeneAnpassenDialog } from '../../OffeneAnpassenDialog'
import type { OffeneFrage } from '@/lib/timeEntries/rates'

/** Ansatz eines Projekts ändern; leer = Ansatz des Kunden. */
export default function ProjectRateButton({ customerId, projekt, projektAnsatz }: { customerId: string; projekt: string; projektAnsatz: number | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [frage, setFrage] = useState<OffeneFrage | null>(null)

  async function save(fd: FormData) {
    setBusy(true)
    const r = await setProjectRateAction(customerId, projekt, fd)
    setBusy(false)
    if (!r.ok) { toast.error(r.error ?? 'Speichern fehlgeschlagen.'); return }
    toast.success('Ansatz gespeichert')
    setOpen(false)
    if (r.frage) setFrage(r.frage)
    router.refresh()
  }

  return (
    <>
      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Ansatz für ${projekt} ändern`} title="Ansatz ändern" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ansatz für «{projekt}»</DialogTitle>
            <DialogDescription>Vorschlag für neue Zeiteinträge dieses Projekts. Leer lassen, damit der Ansatz des Kunden gilt.</DialogDescription>
          </DialogHeader>
          <form action={save} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="projekt-ansatz">Ansatz (Fr.)</Label>
              <DecimalInput id="projekt-ansatz" name="stundensatz" defaultValue={projektAnsatz ?? ''} autoFocus />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}><X className="h-4 w-4 mr-1.5" />Abbrechen</Button>
              <Button type="submit" disabled={busy}><Save className="h-4 w-4 mr-1.5" />Speichern</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <OffeneAnpassenDialog frage={frage} onClose={() => setFrage(null)} />
    </>
  )
}
