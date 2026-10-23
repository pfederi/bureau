import { describe, it, expect } from 'vitest'
import { parseInline, parseMarkdown, parseReleaseNote, compareVersionsDesc, slugify, tableOfContents } from '@/lib/releaseNotes'
import { readFileSync } from 'fs'

describe('parseInline', () => {
  it('splits bold and code', () => {
    expect(parseInline('Die **Kachel** zeigt `Fr. 20.–` an')).toEqual([
      { text: 'Die ' }, { text: 'Kachel', bold: true }, { text: ' zeigt ' }, { text: 'Fr. 20.–', code: true }, { text: ' an' },
    ])
  })
})

describe('parseMarkdown', () => {
  it('builds headings, paragraphs and nested lists', () => {
    const blocks = parseMarkdown('## Neu\n\nIntro text\nweiter\n\n- A\n  - A1\n  - A2\n- B\n')
    expect(blocks[0]).toEqual({ type: 'heading', level: 2, content: [{ text: 'Neu' }] })
    expect(blocks[1]).toEqual({ type: 'paragraph', content: [{ text: 'Intro text weiter' }] })
    expect(blocks[2]).toMatchObject({
      type: 'list',
      items: [
        { content: [{ text: 'A' }], children: [{ content: [{ text: 'A1' }] }, { content: [{ text: 'A2' }] }] },
        { content: [{ text: 'B' }], children: [] },
      ],
    })
  })
})

describe('HTML-Kommentare', () => {
  it('ignoriert HTML-Kommentare', () => {
    expect(parseMarkdown('<!-- hinweis -->\nText\n<!-- /hinweis -->')).toEqual(parseMarkdown('Text'))
  })
})

describe('mehrzeilige HTML-Kommentare', () => {
  it('überspringt Kommentare über mehrere Zeilen', () => {
    expect(parseMarkdown('A\n\n<!-- eins\nzwei -->\n\nB')).toEqual(parseMarkdown('A\n\nB'))
  })
  it('behält Zeilen mit Text ausserhalb des Kommentars', () => {
    expect(parseMarkdown('<!-- x --> Text')).toEqual(parseMarkdown('<!-- x --> Text'))
    expect(parseMarkdown('<!-- x --> Text')).toHaveLength(1)
    expect(parseMarkdown('Text <!-- x -->')).toHaveLength(1)
  })
})

describe('parseReleaseNote', () => {
  it('reads version and date from the title', () => {
    const n = parseReleaseNote('# Version 1.2.0 – 21.10.2026\n\n## Neu\n- X\n')
    expect([n.version, n.datum]).toEqual(['1.2.0', '21.10.2026'])
    expect(n.blocks[0]).toMatchObject({ type: 'heading', level: 2 })
  })
})

describe('compareVersionsDesc', () => {
  it('sorts newest first, numerically', () => {
    expect(['1.2.0', '1.10.0', '1.9.3'].sort(compareVersionsDesc)).toEqual(['1.10.0', '1.9.3', '1.2.0'])
  })
})

describe('tableOfContents', () => {
  it('lists level 2 and 3 headings with anchors', () => {
    expect(slugify('Rechnungen & Offerten')).toBe('rechnungen-offerten')
    expect(slugify('Kunden-Dashboard öffnen')).toBe('kunden-dashboard-oeffnen')
    expect(tableOfContents(parseMarkdown('# Titel\n## Erste Schritte\n### Anmelden\n- x\n## Rechnungen'))).toEqual([
      { id: 'erste-schritte', text: 'Erste Schritte', level: 2 },
      { id: 'anmelden', text: 'Anmelden', level: 3 },
      { id: 'rechnungen', text: 'Rechnungen', level: 2 },
    ])
  })

  it('parses the shipped guide', () => {
    const toc = tableOfContents(parseMarkdown(readFileSync('docs/anleitung.md', 'utf8')))
    expect(toc.length).toBeGreaterThan(5)
    expect(new Set(toc.map(t => t.id)).size).toBe(toc.length)
  })
})
