'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { edition } from '@/edition'
import { Check, Copy, ExternalLink, Link2, Link2Off, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { formatDatum } from '@/lib/utils'
import { portalPath } from '@/lib/portal/path'
import type { Customer } from '@/lib/types'
import { createPortalLinkAction, revokePortalLinkAction } from './actions'
import { HAEKCHEN, useBestaetigung } from '../../../useBestaetigung'

/** Kundenlink: private Seite mit Rechnungen, Materialkonto und Stundenbudget – nur auf Knopfdruck. */
export default function PortalLinkDialog({ customer, open, onOpenChange }: {
  customer: Customer; open: boolean; onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [token, setToken] = useState(customer.portal_token ?? null)
  const [busy, setBusy] = useState(false)
  const [origin, setOrigin] = useState('')
  const [kopiert, bestaetigeKopie] = useBestaetigung()
  useEffect(() => { setOrigin(window.location.origin) }, [])
  useEffect(() => { setToken(customer.portal_token ?? null) }, [customer.portal_token])
  const url = token ? `${origin}${portalPath(token)}` : ''

  async function erstellen() {
    setBusy(true)
    const r = await createPortalLinkAction(customer.id)
    setBusy(false)
    if (!r.ok || !r.token) { toast.error(r.error ?? 'Fehlgeschlagen.'); return }
    toast.success(token ? 'Neuer Kundenlink erstellt – der alte gilt nicht mehr' : 'Kundenlink erstellt')
    setToken(r.token)
    router.refresh()
  }

  async function deaktivieren() {
    setBusy(true)
    const r = await revokePortalLinkAction(customer.id)
    setBusy(false)
    if (!r.ok) { toast.error(r.error ?? 'Fehlgeschlagen.'); return }
    toast.success('Kundenlink deaktiviert')
    setToken(null)
    router.refresh()
  }

  async function kopieren() {
    try { await navigator.clipboard.writeText(url); bestaetigeKopie(); toast.success('Link kopiert') } catch { toast.error('Kopieren nicht möglich – Link bitte markieren.') }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kundenlink</DialogTitle>
          <DialogDescription>
            Private Seite für {customer.firma_oder_name} mit offenen Rechnungen als PDF{' '}
            {edition.material ? 'und, falls vorhanden, Materialkonto und Stundenbudget.' : 'und, falls vorhanden, Stundenbudget.'} Wer den Link hat, sieht die Seite.
          </DialogDescription>
        </DialogHeader>
        {token ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="portal-url">Link</Label>
              <div className="flex gap-2">
                <Input id="portal-url" readOnly value={url} onFocus={e => e.currentTarget.select()} className="font-mono text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={kopieren} aria-label={kopiert ? 'Link kopiert' : 'Link kopieren'} title="Kopieren">
                  {kopiert ? <Check key="ok" className={`h-4 w-4 ${HAEKCHEN}`} /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button asChild variant="outline" size="icon">
                  <a href={url} target="_blank" rel="noreferrer" aria-label="Kundenseite öffnen (neues Fenster)" title="Öffnen">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
              {customer.portal_erstellt_am && token === customer.portal_token && (
                <p className="text-xs text-muted-foreground">Erstellt am {formatDatum(customer.portal_erstellt_am)}</p>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={erstellen}>
                <RefreshCw className="h-4 w-4 mr-1.5" />Neuer Link
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={deaktivieren} className="text-destructive">
                <Link2Off className="h-4 w-4 mr-1.5" />Deaktivieren
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button type="button" disabled={busy} onClick={erstellen}>
              <Link2 className="h-4 w-4 mr-1.5" />Link erstellen
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
