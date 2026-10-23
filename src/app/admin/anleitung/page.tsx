import { loadGuide } from '@/lib/releaseNotesFs'
import { parseMarkdown, tableOfContents, type Block } from '@/lib/releaseNotes'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import MarkdownBlocks from '../MarkdownBlocks'

export const metadata = { title: 'Anleitung' }

export default async function AnleitungPage() {
  const blocks = parseMarkdown(await loadGuide())
  const toc = tableOfContents(blocks)
  // Einleitung = Absätze vor der ersten Zwischenüberschrift
  const firstSection = blocks.findIndex(b => b.type === 'heading' && b.level === 2)
  const intro = blocks.slice(0, firstSection).filter(b => b.type === 'paragraph')
  // Je Hauptabschnitt (##) eine eigene Karte
  const sections: Block[][] = []
  for (const b of blocks.slice(firstSection)) {
    if (b.type === 'heading' && b.level === 2) sections.push([b])
    else sections[sections.length - 1]?.push(b)
  }

  return (
    <div className="space-y-6">
      <div className="max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Anleitung</h1>
        <MarkdownBlocks blocks={intro} />
      </div>
      <div className="grid max-w-6xl gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Inhalt der Anleitung" className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="pt-4 sm:pt-6">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Inhalt</div>
              <ul className="space-y-1 text-sm">
                {toc.map(e => (
                  <li key={e.id}>
                    <a
                      href={`#${e.id}`}
                      className={cn(
                        'block rounded-md px-2 py-1 hover:bg-slate-700/60 hover:text-blue-300',
                        e.level === 2 ? 'font-medium text-foreground' : 'pl-5 text-muted-foreground',
                      )}
                    >
                      {e.text}
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </nav>
        <div className="space-y-4">
          {sections.map((section, i) => (
            <Card key={i}>
              {/* Überschrift ohne Abstand oben, da sie die Karte eröffnet */}
              <CardContent className="pt-4 sm:pt-6 [&_h2:first-child]:pt-0">
                <MarkdownBlocks blocks={section} anchors />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
