'use client'
import { useEffect } from 'react'

/**
 * Setzt Klassen zusätzlich auf <body>, solange der Admin offen ist. Radix hängt
 * Dialoge, Menüs und Selects per Portal direkt in <body> ein – ausserhalb des
 * Admin-Shells würden sie sonst helle Farben und die Website-Schrift erben.
 */
export default function BodyClass({ className }: { className: string }) {
  useEffect(() => {
    const classes = className.split(/\s+/).filter(Boolean)
    const lang = document.documentElement.lang
    document.body.classList.add(...classes)
    // Admin ist deutsch, die Website englisch (WCAG 3.1.1 Sprache der Seite).
    document.documentElement.lang = 'de'
    return () => {
      document.body.classList.remove(...classes)
      document.documentElement.lang = lang
    }
  }, [className])
  return null
}
