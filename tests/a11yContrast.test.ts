import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { contrastRatio, hslTokenToRgb, readTokens, blend, readTailwindColors, oklchToRgb, hexToRgb, type Rgb } from '@/lib/a11y/contrast'

// WCAG 2.2 AA: Text 4.5:1 (1.4.3), Bedienelemente und Grafiken 3:1 (1.4.11).
const TEXT = 4.5
const UI = 3

const tokens = readTokens(readFileSync('src/app/globals.css', 'utf8'), '.admin-dark')
const t = (name: string): Rgb => hslTokenToRgb(tokens[name])

// Im Admin fest verwendete Tailwind-Farben, direkt aus Tailwind 4 (OKLCH, umgerechnet nach sRGB)
const tw = readTailwindColors(readFileSync('node_modules/tailwindcss/theme.css', 'utf8'))

describe('Kontraste im Admin (WCAG 2.2 AA)', () => {
  const surfaces: Record<string, Rgb> = {
    Hintergrund: t('background'),
    Karte: t('card'),
    'Zeile beim Darüberfahren': blend(t('muted'), t('card'), 0.5),
  }

  const textPairs: [string, Rgb][] = [
    ['Text', t('foreground')],
    ['gedämpfter Text', t('muted-foreground')],
    ['Akzent (Links, aktive Elemente)', t('primary')],
    ['Fehler/Löschen', t('destructive')],
    ['Navigation inaktiv', tw['slate-300']],
    ['Navigation/Hover Blau', tw['blue-300']],
    ['Bezahlt/Gedeckt', tw['green-400']],
    ['Warnung', tw['amber-400']],
    ['Überschritten', tw['red-300']],
  ]

  for (const [surface, bg] of Object.entries(surfaces)) {
    for (const [name, fg] of textPairs) {
      it(`${name} auf ${surface} ≥ ${TEXT}:1`, () => {
        expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(TEXT)
      })
    }
  }

  it('Text auf Akzent-Knöpfen ≥ 4.5:1', () => {
    expect(contrastRatio(t('primary-foreground'), t('primary'))).toBeGreaterThanOrEqual(TEXT)
  })
  it('Text auf Lösch-Knöpfen ≥ 4.5:1', () => {
    expect(contrastRatio(t('destructive-foreground'), t('destructive'))).toBeGreaterThanOrEqual(TEXT)
  })
  it('Text auf grauen Badges ≥ 4.5:1', () => {
    expect(contrastRatio(t('secondary-foreground'), t('secondary'))).toBeGreaterThanOrEqual(TEXT)
  })
  it('Warnhinweis (amber-200 auf amber-950/40 über Karte) ≥ 4.5:1', () => {
    expect(contrastRatio(tw['amber-200'], blend(hexToRgb('#451a03'), t('card'), 0.4))).toBeGreaterThanOrEqual(TEXT)
  })

  it('Rahmen von Eingabefeldern ≥ 3:1 (1.4.11)', () => {
    expect(contrastRatio(t('input'), t('card'))).toBeGreaterThanOrEqual(UI)
    expect(contrastRatio(t('input'), t('background'))).toBeGreaterThanOrEqual(UI)
  })
  it('Fokusring ≥ 3:1 (2.4.7/1.4.11)', () => {
    expect(contrastRatio(t('ring'), t('card'))).toBeGreaterThanOrEqual(UI)
    expect(contrastRatio(t('ring'), t('background'))).toBeGreaterThanOrEqual(UI)
  })
  it('Diagrammfarben und Fortschrittsbalken ≥ 3:1 auf der Karte (1.4.11)', () => {
    for (const c of ['blue-400', 'teal-400', 'amber-400', 'violet-400', 'rose-400', 'emerald-400', 'sky-300', 'orange-400', 'fuchsia-400', 'lime-400', 'red-400']) {
      expect(contrastRatio(tw[c], t('card')), c).toBeGreaterThanOrEqual(UI)
    }
    expect(contrastRatio(t('primary'), t('muted'))).toBeGreaterThanOrEqual(UI)
  })
})

describe('oklchToRgb', () => {
  it('converts Tailwind 4 colors to sRGB like the browser', () => {
    // Referenzwerte aus Tailwinds Dokumentation (hex der OKLCH-Farben)
    expect(oklchToRgb('oklch(80.9% 0.105 251.813)')).toEqual(hexToRgb('#8ec5ff')) // blue-300
    expect(oklchToRgb('oklch(20.8% 0.042 265.755)')).toEqual(hexToRgb('#0f172b')) // slate-900
    expect(Object.keys(tw)).toContain('amber-400')
  })
})
