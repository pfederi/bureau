import { Globe } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDatum, formatZeitpunkt } from '@/lib/utils'
import { siteStatus, type PortalSite } from '@/lib/monitoring/sites'
import AlarmPunkt from '@/app/admin/AlarmPunkt'

/** Status der überwachten Websites auf der Kundenseite – ohne Aussetzer und technische Details. */
export default function PortalSitesCard({ sites }: { sites: PortalSite[] }) {
  if (sites.length === 0) return null
  return (
    <Card>
      <CardContent className="pt-4 sm:pt-6">
        <h2 className="karte-titel -mt-3 py-3 text-sm font-medium">{sites.length === 1 ? 'Website' : 'Websites'}</h2>
        <ul className="divide-y rounded-md border">
          {sites.map(s => (
            <li key={s.id} className="flex items-start gap-3 px-3 py-2.5">
              <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Nur http(s) als Link (gespeichert wird ohnehin nur das, siehe normalizeSiteUrl) */}
                  <a href={/^https?:\/\//i.test(s.url) ? s.url : undefined} target="_blank" rel="noreferrer" className="rounded-sm text-sm font-medium text-blue-300 underline-offset-4 wrap-anywhere hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
                    {s.url.replace(/^https?:\/\//, '')}<span className="sr-only"> (öffnet in neuem Fenster)</span>
                  </a>
                  <Status site={s} />
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
                  {s.geprueft_am && <span>Zuletzt geprüft {formatZeitpunkt(s.geprueft_am)}</span>}
                  {s.ssl_ablauf && <span>SSL-Zertifikat bis {formatDatum(s.ssl_ablauf)}</span>}
                  {s.domain_ablauf && <span>Domain bis {formatDatum(s.domain_ablauf)}</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function Status({ site }: { site: PortalSite }) {
  const status = siteStatus(site, { aussetzer: false })
  if (status === 'ungeprueft') return <Badge variant="secondary">Noch nicht geprüft</Badge>
  if (status === 'down') {
    return (
      <Badge variant="outline" className="gap-1.5 border-red-400 text-red-300">
        <AlarmPunkt />Nicht erreichbar{site.down_seit ? ` seit ${formatZeitpunkt(site.down_seit)}` : ''}
      </Badge>
    )
  }
  return <Badge variant="outline" className="border-green-500 text-green-400">Erreichbar</Badge>
}
