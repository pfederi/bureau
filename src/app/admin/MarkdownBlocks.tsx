import { Fragment } from 'react'
import { slugify, type Block, type Inline, type ListItem } from '@/lib/releaseNotes'
import { cn } from '@/lib/utils'

function Text({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.code ? <code key={i} className="rounded bg-muted px-1 py-0.5 text-[0.9em]">{p.text}</code>
          : p.bold ? <strong key={i} className="font-medium text-foreground">{p.text}</strong>
            : <Fragment key={i}>{p.text}</Fragment>)}
    </>
  )
}

function List({ items, nested = false }: { items: ListItem[]; nested?: boolean }) {
  return (
    <ul className={cn('list-disc space-y-1.5 pl-5 marker:text-muted-foreground', nested && 'mt-1.5')}>
      {items.map((it, i) => (
        <li key={i}>
          <Text parts={it.content} />
          {it.children.length > 0 && <List items={it.children} nested />}
        </li>
      ))}
    </ul>
  )
}

/**
 * Rendert die Blöcke aus `parseMarkdown`; mit `anchors` bekommen Überschriften Sprungmarken.
 * `nested`: Überschriften eine Ebene tiefer (## → h3), wenn der Block unter einer h2 steht.
 */
export default function MarkdownBlocks({ blocks, anchors = false, nested = false }: { blocks: Block[]; anchors?: boolean; nested?: boolean }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-300">
      {blocks.map((b, i) => {
        if (b.type === 'heading') {
          const id = anchors ? slugify(b.content.map(c => c.text).join('')) : undefined
          if (b.level === 1) return null
          const Tag = (`h${b.level + (nested ? 1 : 0)}`) as 'h2' | 'h3' | 'h4'
          return b.level === 2
            ? <Tag key={i} id={id} className={cn('scroll-mt-24 font-semibold tracking-tight text-blue-300', nested ? 'pt-3 text-base' : 'pt-4 text-lg')}><Text parts={b.content} /></Tag>
            : <Tag key={i} id={id} className="scroll-mt-24 pt-2 font-medium text-foreground"><Text parts={b.content} /></Tag>
        }
        if (b.type === 'list') return <List key={i} items={b.items} />
        return <p key={i}><Text parts={b.content} /></p>
      })}
    </div>
  )
}
