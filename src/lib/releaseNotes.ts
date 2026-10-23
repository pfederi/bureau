/**
 * Release Notes aus docs/release-notes/v*.md. Kleiner Markdown-Parser für genau
 * das, was die Notes verwenden: Überschriften, (verschachtelte) Listen, Absätze,
 * **fett** und `code`.
 */

export type Inline = { text: string; bold?: boolean; code?: boolean }
export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; content: Inline[] }
  | { type: 'paragraph'; content: Inline[] }
  | { type: 'list'; items: ListItem[] }
export type ListItem = { content: Inline[]; children: ListItem[] }

export type ReleaseNote = { version: string; datum: string | null; blocks: Block[] }

export function parseInline(text: string): Inline[] {
  const parts: Inline[] = []
  const re = /\*\*(.+?)\*\*|`([^`]+)`/g
  let last = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) })
    parts.push(m[1] !== undefined ? { text: m[1], bold: true } : { text: m[2], code: true })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}

export function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = []
  let paragraph: string[] = []
  // Stapel offener Listen: Einrückung (Leerzeichen) → Liste
  let stack: { indent: number; items: ListItem[] }[] = []

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', content: parseInline(paragraph.join(' ')) })
    paragraph = []
  }
  const closeLists = () => { stack = [] }
  let inComment = false

  for (const raw of md.split('\n')) {
    const line = raw.replace(/\s+$/, '')
    // HTML-Kommentare (z. B. Editions-Marker) nicht anzeigen; Zeilen mit Text ausserhalb des Kommentars bleiben
    if (inComment) { if (line.includes('-->')) inComment = false; continue }
    if (/^\s*<!--/.test(line)) {
      const end = line.indexOf('-->')
      if (end === -1) { inComment = true; continue }
      if (line.slice(end + 3).trim() === '') continue
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    const item = /^(\s*)[-*]\s+(.*)$/.exec(line)
    if (heading) {
      flushParagraph(); closeLists()
      blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3, content: parseInline(heading[2]) })
    } else if (item) {
      flushParagraph()
      const indent = item[1].length
      const node: ListItem = { content: parseInline(item[2]), children: [] }
      while (stack.length && stack[stack.length - 1].indent > indent) stack.pop()
      const top = stack[stack.length - 1]
      if (!top) {
        const list = { type: 'list' as const, items: [node] }
        blocks.push(list)
        stack = [{ indent, items: list.items }]
      } else if (indent > top.indent) {
        const parent = top.items[top.items.length - 1]
        parent.children.push(node)
        stack.push({ indent, items: parent.children })
      } else {
        top.items.push(node)
      }
    } else if (line.trim() === '') {
      flushParagraph()
    } else if (stack.length && /^\s+/.test(line)) {
      // Fortsetzungszeile eines Listenpunkts
      const items = stack[stack.length - 1].items
      items[items.length - 1].content.push(...parseInline(` ${line.trim()}`))
    } else {
      closeLists()
      paragraph.push(line.trim())
    }
  }
  flushParagraph()
  return blocks
}

/** Titel «# Version 1.2.0 – 21.10.2026» → Version und Datum; der Titel selbst wird nicht als Block geliefert. */
export function parseReleaseNote(md: string): ReleaseNote {
  const blocks = parseMarkdown(md)
  const first = blocks[0]
  const title = first?.type === 'heading' && first.level === 1 ? first.content.map(c => c.text).join('') : ''
  const m = /Version\s+(\d+\.\d+\.\d+)(?:\s*[–-]\s*(.+))?/.exec(title)
  return {
    version: m?.[1] ?? '0.0.0',
    datum: m?.[2]?.trim() ?? null,
    blocks: title ? blocks.slice(1) : blocks,
  }
}

/** Semantische Versionen absteigend vergleichen (neueste zuerst). */
export function compareVersionsDesc(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return (pb[i] ?? 0) - (pa[i] ?? 0)
  return 0
}

/** Anker aus einer Überschrift: «Rechnungen & Offerten» → «rechnungen-offerten» */
export function slugify(text: string): string {
  return text.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export type TocEntry = { id: string; text: string; level: 2 | 3 }

/** Inhaltsverzeichnis aus den Überschriften der Ebenen 2 und 3. */
export function tableOfContents(blocks: Block[]): TocEntry[] {
  return blocks.flatMap(b => {
    if (b.type !== 'heading' || b.level === 1) return []
    const text = b.content.map(c => c.text).join('')
    return [{ id: slugify(text), text, level: b.level as 2 | 3 }]
  })
}
