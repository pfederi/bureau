/** Kontrastverhältnis nach WCAG 2.x (relative Leuchtdichte). */

export type Rgb = [number, number, number]

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '')
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as Rgb
}

/** shadcn-Token-Format «217.2 32.6% 17.5%» → RGB */
export function hslTokenToRgb(token: string): Rgb {
  const [h, s, l] = token.trim().split(/\s+/).map(v => parseFloat(v))
  const S = s / 100, L = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = S * Math.min(L, 1 - L)
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)].map(v => Math.round(v * 255)) as Rgb
}

function luminance([r, g, b]: Rgb): number {
  const c = [r, g, b].map(v => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Farbe mit Deckkraft `alpha` über einem Hintergrund (z. B. bg-muted/50). */
export function blend(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha))) as Rgb
}

/** Liest die Tokens eines CSS-Blocks wie `.admin-dark { --x: … }`. */
export function readTokens(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`Block ${selector} nicht gefunden`)
  const body = css.slice(start, css.indexOf('}', start))
  const tokens: Record<string, string> = {}
  for (const m of Array.from(body.matchAll(/--([a-z-]+):\s*([^;]+);/g))) tokens[m[1]] = m[2].replace(/\/\*.*\*\//, '').trim()
  return tokens
}

/** «oklch(80.9% 0.105 251.813)» (Tailwind 4) → sRGB 0–255, ausserhalb des Farbraums begrenzt. */
export function oklchToRgb(value: string): Rgb {
  // Grautöne haben keinen Farbton («none»)
  const m = value.match(/oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+|none)/)
  if (!m) throw new Error(`Keine OKLCH-Farbe: ${value}`)
  const L = Number(m[1]) / 100, C = Number(m[2]), h = m[3] === 'none' ? 0 : (Number(m[3]) * Math.PI) / 180
  const a = C * Math.cos(h), b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ]
  const gamma = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)
  return lin.map(x => Math.round(Math.min(1, Math.max(0, gamma(x))) * 255)) as Rgb
}

/** Standardfarben aus Tailwinds theme.css, z. B. { 'blue-300': [142, 197, 255] } */
export function readTailwindColors(themeCss: string): Record<string, Rgb> {
  const out: Record<string, Rgb> = {}
  for (const [, name, value] of Array.from(themeCss.matchAll(/--color-([a-z]+-\d+):\s*(oklch\([^)]*\))/g))) out[name] = oklchToRgb(value)
  return out
}
