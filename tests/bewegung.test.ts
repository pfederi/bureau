import { describe, it, expect } from 'vitest'
import { gespeichertSpeicher, neueIds, zwischenwert } from '@/lib/bewegung'

describe('gespeichertSpeicher', () => {
  it('meldet eine gerade gespeicherte ID einmal als frisch, innerhalb der Frist', () => {
    let jetzt = 1000
    const s = gespeichertSpeicher(() => jetzt, 5000)
    s.markiere('a')
    expect(s.nimm('b')).toBe(false)
    expect(s.nimm('a')).toBe(true)
    expect(s.nimm('a')).toBe(false) // nur einmal
    s.markiere('c')
    jetzt += 5001
    expect(s.nimm('c')).toBe(false) // zu alt
  })
  it('benachrichtigt Zuhörer', () => {
    const s = gespeichertSpeicher(() => 0, 5000)
    const gehoert: string[] = []
    const weg = s.hoere(id => gehoert.push(id))
    s.markiere('x')
    weg()
    s.markiere('y')
    expect(gehoert).toEqual(['x'])
  })
})

describe('neueIds', () => {
  it('beim ersten Anzeigen nichts, danach nur hinzugekommene', () => {
    expect(neueIds(null, ['a', 'b'])).toEqual(new Set())
    expect(neueIds(['a', 'b'], ['c', 'a', 'b'])).toEqual(new Set(['c']))
    expect(neueIds(['a', 'b'], ['a'])).toEqual(new Set())
  })
})

describe('zwischenwert', () => {
  it('beginnt beim alten, endet beim neuen Wert, auf Rappen gerundet, mit sanftem Auslaufen', () => {
    expect(zwischenwert(100, 200, 0)).toBe(100)
    expect(zwischenwert(100, 200, 1)).toBe(200)
    const mitte = zwischenwert(100, 200, 0.5)
    expect(mitte).toBeGreaterThan(150) // Ausrollen: in der Mitte schon über der Hälfte
    expect(Math.round(mitte * 100)).toBe(mitte * 100)
    expect(zwischenwert(0, 10, 2)).toBe(10)
  })
})
