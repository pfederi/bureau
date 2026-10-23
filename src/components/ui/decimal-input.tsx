'use client'
import * as React from 'react'
import { Input } from '@/components/ui/input'
import { normalizeDecimal } from '@/lib/decimal'

type Props = Omit<React.ComponentProps<typeof Input>, 'type' | 'value' | 'onChange' | 'step' | 'min' | 'max'> & {
  /** Zahl: Eingabe als Entwurf halten (z. B. „12.“ beim Tippen), Text: unverändert durchreichen */
  value?: number | string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  /** Nur bei `value` als Zahl: neuer Zahlenwert (leer = 0) */
  onValueChange?: (n: number) => void
  step?: unknown
  min?: unknown
  max?: unknown
}

/**
 * Zahlenfeld mit Dezimalpunkt. `type="number"` zeigt Dezimalzahlen im Format des
 * Betriebssystems (in der Schweiz oft mit Komma); hier gilt immer der Punkt wie
 * in `Fr. 12.50`, ein getipptes Komma wird zum Punkt.
 */
export const DecimalInput = React.forwardRef<HTMLInputElement, Props>(function DecimalInput(
  { value, onChange, onValueChange, step: _step, min: _min, max: _max, ...rest }, ref,
) {
  const numeric = typeof value === 'number'
  const [draft, setDraft] = React.useState(numeric ? String(value) : '')

  // Von aussen geänderte Zahl übernehmen (z. B. Position aus der Zeiterfassung)
  React.useEffect(() => {
    if (numeric && Number(draft) !== value) setDraft(String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <Input
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      pattern="-?[0-9]*[.]?[0-9]*"
      title="Zahl mit Punkt, z. B. 12.50"
      {...rest}
      value={numeric ? draft : value}
      onChange={e => {
        const el = e.target
        const pos = el.selectionStart
        const v = normalizeDecimal(el.value)
        if (v !== el.value) {
          el.value = v
          if (pos !== null) el.setSelectionRange(pos, pos)
        }
        if (numeric) {
          setDraft(v)
          const n = Number(v)
          if (!Number.isNaN(n)) onValueChange?.(n)
        }
        onChange?.(e)
      }}
    />
  )
})
