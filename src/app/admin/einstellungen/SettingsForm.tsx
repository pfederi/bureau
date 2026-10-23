'use client'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Check, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HAEKCHEN, useBestaetigung } from '../useBestaetigung'
import { saveSettings } from './actions'

function SpeichernKnopf({ gespeichert }: { gespeichert: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" aria-busy={pending}>
      {gespeichert ? <Check key="ok" className={`h-4 w-4 mr-1.5 ${HAEKCHEN}`} /> : <Save className="h-4 w-4 mr-1.5" />}
      {pending ? 'Speichern…' : gespeichert ? 'Gespeichert' : 'Speichern'}
    </Button>
  )
}

/** Formular der Angaben mit Rückmeldung (Toast, Häkchen im Knopf) statt Fehlerseite bei ungültigen Eingaben. */
export default function SettingsForm({ children, className }: { children: ReactNode; className?: string }) {
  const router = useRouter()
  const [gespeichert, bestaetige] = useBestaetigung()
  return (
    <form
      className={className}
      action={async fd => {
        const r = await saveSettings(fd)
        if (!r.ok) { toast.error(r.error ?? 'Speichern fehlgeschlagen.'); return }
        bestaetige()
        toast.success('Einstellungen gespeichert')
        router.refresh()
      }}
    >
      {children}
      <div className="md:col-span-2 flex justify-end">
        <SpeichernKnopf gespeichert={gespeichert} />
      </div>
    </form>
  )
}
