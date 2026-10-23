'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

/** Kurze Bestätigung im Knopf (z. B. Häkchen statt Kopieren-Symbol), danach wieder normal. */
export function useBestaetigung(ms = 1800): [boolean, () => void] {
  const [aktiv, setAktiv] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const ausloesen = useCallback(() => {
    setAktiv(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setAktiv(false), ms)
  }, [ms])
  return [aktiv, ausloesen]
}

/** Klassen für das Häkchen: springt kurz auf (nur ohne «Bewegung reduzieren»). */
export const HAEKCHEN = 'text-green-400 motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:fade-in-0 motion-safe:duration-200'
