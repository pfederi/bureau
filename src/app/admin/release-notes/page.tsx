import { notFound } from 'next/navigation'
import { edition } from '@/edition'
import { loadReleaseNotes, loadEffort } from '@/lib/releaseNotesFs'
import { effortByVersion, effortValue, formatDauer, totalMinutes } from '@/lib/effort'
import { getSettings } from '@/lib/db/settings'
import { formatChf } from '@/lib/invoices/stats'
import { Card, CardContent } from '@/components/ui/card'
import MarkdownBlocks from '../MarkdownBlocks'
import { ChfValue } from '../DashboardWidgets'

export const metadata = { title: 'Release Notes' }

export default async function ReleaseNotesPage() {
  if (!edition.releaseNotes) notFound()
  const [notes, effort, settings] = await Promise.all([loadReleaseNotes(), loadEffort(), getSettings().catch(() => null)])
  const aufwand = effortByVersion(effort)
  const total = totalMinutes(effort)
  // Gegenwert: was die Arbeit zum eigenen Stundensatz gekostet hätte (keine abziehbare Ausgabe)
  const satz = Number(settings?.standard_stundensatz ?? 0)
  return (
    // Fliesstext: Zeilenlänge für gute Lesbarkeit begrenzen
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Release Notes</h1>
        <p className="text-sm text-muted-foreground">Was sich in welcher Version geändert hat, neueste zuerst.</p>
      </div>
      {total > 0 && (
        <Card>
          <CardContent className="grid gap-6 pt-4 sm:pt-6 sm:grid-cols-2">
            <div>
              <div className="text-sm text-muted-foreground">Gesamtaufwand</div>
              <div className="mt-1 text-3xl font-medium tracking-tight tabular-nums">{formatDauer(total).replace(/^ca\. /, '')}</div>
              <div className="mt-1.5 text-xs text-muted-foreground">Über {aufwand.size} Versionen. {effort?.hinweis}</div>
            </div>
            {satz > 0 && (
              <div className="sm:border-l sm:pl-6">
                <div className="text-sm text-muted-foreground">Gegenwert</div>
                <div className="mt-1 text-3xl font-medium tracking-tight tabular-nums"><ChfValue amount={effortValue(total, satz)} /></div>
                <div className="mt-1.5 text-xs text-muted-foreground">
                  Was die Arbeit zum Stundensatz von {formatChf(satz)} gekostet hätte. Eigene Arbeitszeit ist keine abziehbare Ausgabe und zählt nicht im Jahresabschluss.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {notes.map(n => (
        <Card key={n.version} id={`v${n.version}`}>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-xl font-semibold tracking-tight">Version {n.version}</h2>
              <span className="text-right text-sm text-muted-foreground">
                {n.datum}
                {aufwand.get(n.version) && (
                  <span className="block text-xs" title={`${aufwand.get(n.version)!.sitzungen} Arbeitssitzungen`}>
                    Aufwand {formatDauer(aufwand.get(n.version)!.minuten)}
                    {satz > 0 && ` · Gegenwert ${formatChf(effortValue(aufwand.get(n.version)!.minuten, satz))}`}
                  </span>
                )}
              </span>
            </div>
            <MarkdownBlocks blocks={n.blocks} nested />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
