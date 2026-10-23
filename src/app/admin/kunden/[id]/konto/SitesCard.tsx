'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Globe, Plus, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatDatum } from '@/lib/utils'
import {
  DOWN_AB_FEHLVERSUCHEN, DOMAIN_WARNUNG_TAGE, SSL_WARNUNG_TAGE, registrableDomain, siteHost, tageBis, type MonitoredSite,
} from '@/lib/monitoring/sites'
import { addSiteAction, checkSitesAction, removeSiteAction } from './actions'
import { HAEKCHEN, useBestaetigung } from '../../../useBestaetigung'
import AlarmPunkt from '../../../AlarmPunkt'

const zeit = (iso: string) => new Date(iso).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' })

function Status({ site }: { site: MonitoredSite }) {
  if (site.erreichbar === null) return <Badge variant="secondary">Noch nicht geprüft</Badge>
  if (site.fehlversuche >= DOWN_AB_FEHLVERSUCHEN) {
    return <Badge variant="outline" className="gap-1.5 border-red-400 text-red-300"><AlarmPunkt />Nicht erreichbar</Badge>
  }
  if (site.fehlversuche > 0) return <Badge variant="outline" className="border-amber-400 text-amber-400">Aussetzer</Badge>
  return <Badge variant="outline" className="border-green-500 text-green-400">Erreichbar</Badge>
}

function Ablauf({ label, datum, warnTage, ohne }: { label: string; datum: string | null; warnTage: number; ohne: string }) {
  if (!datum) return <span>{label}: {ohne}</span>
  const t = tageBis(datum, new Date())
  return <span className={t <= warnTage ? 'text-amber-400' : undefined}>{label} bis {formatDatum(datum)}</span>
}

/** Überwachte Websites des Kunden: Erreichbarkeit, SSL-Zertifikat, Domain. */
export default function SitesCard({ customerId, sites }: { customerId: string; sites: MonitoredSite[] }) {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState<'add' | 'check' | string | null>(null)
  const [geprueft, bestaetigePruefung] = useBestaetigung()

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setBusy('add')
    const r = await addSiteAction(customerId, url)
    setBusy(null)
    if (!r.ok) { toast.error(r.error ?? 'Fehlgeschlagen.'); return }
    toast.success('Website hinzugefügt und geprüft')
    setUrl('')
    router.refresh()
  }

  async function check() {
    setBusy('check')
    const r = await checkSitesAction(customerId)
    setBusy(null)
    if (!r.ok) { toast.error(r.error ?? 'Fehlgeschlagen.'); return }
    bestaetigePruefung()
    toast.success('Websites geprüft')
    router.refresh()
  }

  async function remove(site: MonitoredSite) {
    setBusy(site.id)
    const r = await removeSiteAction(site.id)
    setBusy(null)
    if (!r.ok) { toast.error(r.error ?? 'Fehlgeschlagen.'); return }
    toast.success(`${siteHost(site.url)} wird nicht mehr überwacht`)
    router.refresh()
  }

  return (
    <Card id="websites" className="scroll-mt-24">
      <CardContent className="pt-4 sm:pt-6">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-medium">Websites</h2>
            <p className="text-xs text-muted-foreground">
              Erreichbarkeit alle 15 Minuten, SSL-Zertifikat und Domain täglich. Fällt eine Seite aus, bekommst du eine Mail.
            </p>
          </div>
          {sites.length > 0 && (
            <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={check}>
              {geprueft
                ? <Check key="ok" className={`h-4 w-4 mr-1.5 ${HAEKCHEN}`} />
                : <RefreshCw className={`h-4 w-4 mr-1.5 ${busy === 'check' ? 'motion-safe:animate-spin' : ''}`} />}
              {geprueft ? 'Geprüft' : 'Jetzt prüfen'}
            </Button>
          )}
        </div>
        {sites.length > 0 && (
          <ul className="mb-4 divide-y rounded-md border">
            {sites.map(s => (
              <li key={s.id} className="flex items-start gap-3 px-3 py-2.5">
                <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={s.url} target="_blank" rel="noreferrer" className="rounded-sm text-sm font-medium wrap-anywhere hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
                      {s.url.replace(/^https?:\/\//, '')}
                    </a>
                    <Status site={s} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
                    {s.fehlversuche > 0 && s.fehler && <span className="text-red-300">{s.fehler}</span>}
                    {s.erreichbar && s.antwort_ms !== null && <span>{s.antwort_ms} ms</span>}
                    {s.url.startsWith('https:') && <Ablauf label="SSL" datum={s.ssl_ablauf} warnTage={SSL_WARNUNG_TAGE} ohne="unbekannt" />}
                    <Ablauf
                      label="Domain" datum={s.domain_ablauf} warnTage={DOMAIN_WARNUNG_TAGE}
                      ohne={/\.(ch|li)$/.test(registrableDomain(siteHost(s.url))) ? 'Ablauf bei .ch nicht abrufbar' : 'unbekannt'}
                    />
                    {s.geprueft_am && <span>geprüft {formatDatum(s.geprueft_am)} {zeit(s.geprueft_am)}</span>}
                  </div>
                </div>
                <Button
                  type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={busy !== null}
                  aria-label={`${siteHost(s.url)} nicht mehr überwachen`} title="Entfernen" onClick={() => remove(s)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={add} className="flex gap-2">
          <Input
            value={url} onChange={e => setUrl(e.target.value)} placeholder="kunde.ch" aria-label="Website-Adresse"
            inputMode="url" autoComplete="off" className="min-w-0"
          />
          <Button type="submit" variant="outline" disabled={busy !== null || !url.trim()} className="shrink-0">
            <Plus className="h-4 w-4 mr-1.5" />{busy === 'add' ? 'Prüfen…' : 'Hinzufügen'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
