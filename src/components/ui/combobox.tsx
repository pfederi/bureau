'use client'

import * as React from 'react'
import { Check, ChevronDown } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type ComboboxProps = Omit<
  React.ComponentPropsWithoutRef<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'list'
> & {
  options: readonly string[]
  /** Unkontrolliert (Formular liest über `name`). */
  defaultValue?: string
  /** Kontrolliert – zusammen mit onValueChange. */
  value?: string
  onValueChange?: (value: string) => void
}

/**
 * Freitext-Feld mit Vorschlagsliste. Ersetzt <input list=…>/<datalist>, damit die
 * Vorschläge im gleichen Popover-Look erscheinen wie bei <Select> (siehe select.tsx)
 * statt im browsereigenen Dropdown.
 */
const Combobox = React.forwardRef<HTMLInputElement, ComboboxProps>(function Combobox(
  { options, className, defaultValue = '', value: controlledValue, onValueChange, onKeyDown, onBlur, ...props },
  forwardedRef
) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
  const value = controlledValue ?? uncontrolledValue
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(-1)

  const rootRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  React.useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement)
  const listId = React.useId()

  const query = value.trim().toLowerCase()
  // Beim Tippen filtern; sobald der Wert exakt einer Option entspricht, wieder alle zeigen.
  const exactMatch = options.some(o => o.toLowerCase() === query)
  const items = query === '' || exactMatch ? options : options.filter(o => o.toLowerCase().includes(query))

  function setValue(next: string) {
    if (controlledValue === undefined) setUncontrolledValue(next)
    onValueChange?.(next)
  }

  function choose(option: string) {
    setValue(option)
    setOpen(false)
    setActiveIndex(-1)
  }

  // Klick ausserhalb schliesst die Liste.
  React.useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const listVisible = open && items.length > 0

  return (
    <div ref={rootRef} className="relative">
      <Input
        ref={inputRef}
        role="combobox"
        aria-expanded={listVisible}
        aria-controls={listVisible ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={listVisible && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        className={cn('pr-8', className)}
        value={value}
        onChange={e => {
          setValue(e.target.value)
          setOpen(true)
          setActiveIndex(-1)
        }}
        onKeyDown={e => {
          onKeyDown?.(e)
          if (e.defaultPrevented) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (!open) { setOpen(true); return }
            setActiveIndex(i => Math.min(i + 1, items.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            if (!open) { setOpen(true); return }
            setActiveIndex(i => Math.max(i - 1, 0))
          } else if (e.key === 'Enter') {
            // Nur abfangen, wenn ein Vorschlag markiert ist – sonst normal absenden.
            if (listVisible && activeIndex >= 0) {
              e.preventDefault()
              choose(items[activeIndex])
            }
          } else if (e.key === 'Escape') {
            if (open) {
              e.stopPropagation() // nicht den umgebenden Dialog schliessen
              setOpen(false)
              setActiveIndex(-1)
            }
          } else if (e.key === 'Tab') {
            setOpen(false)
          }
        }}
        onBlur={e => {
          onBlur?.(e)
          // Klicks auf Optionen verhindern den Blur (onMouseDown preventDefault),
          // hier also nur echtes Verlassen des Felds.
          if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false)
        }}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Vorschläge anzeigen"
        // right-3 = px-3 des SelectTrigger, damit das Chevron exakt gleich sitzt
        className="absolute right-3 top-0 flex h-9 items-center"
        onMouseDown={e => e.preventDefault()}
        onClick={() => {
          setOpen(o => !o)
          setActiveIndex(-1)
          inputRef.current?.focus()
        }}
      >
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>

      {listVisible && (
        <div
          id={listId}
          role="listbox"
          className="absolute top-full z-50 mt-1 max-h-60 w-full min-w-32 overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 slide-in-from-top-2"
        >
          {items.map((option, i) => {
            const selected = option.toLowerCase() === query
            return (
              <div
                key={option}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={selected}
                className={cn(
                  'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-hidden',
                  i === activeIndex && 'bg-accent text-accent-foreground'
                )}
                onMouseDown={e => e.preventDefault()} // Fokus im Input halten
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => choose(option)}
              >
                <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                  {selected && <Check className="h-4 w-4" />}
                </span>
                {option}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

export { Combobox }
