import { describe, it, expect } from 'vitest'
import { ahvBeitrag, estimateReserve } from '@/lib/expenses/reserve'

describe('ahvBeitrag (Ansätze 2026)', () => {
  it('charges nothing up to the side-income threshold', () => {
    expect(ahvBeitrag(2500, 2026).beitrag).toBe(0)
    expect(ahvBeitrag(-100, 2026).beitrag).toBe(0)
  })
  it('uses the lowest rate below 10 100 when the minimum is paid via salary', () => {
    expect(ahvBeitrag(5000, 2026)).toMatchObject({ satz: 5.371, beitrag: 268.55, verwaltungskosten: 13.43 })
  })
  it('uses the minimum contribution without employment', () => {
    expect(ahvBeitrag(5000, 2026, false).beitrag).toBe(530)
  })
  it('follows the sliding scale and the full rate', () => {
    expect(ahvBeitrag(11_687.43, 2026).satz).toBe(5.371)
    expect(ahvBeitrag(20_000, 2026).satz).toBe(5.494)
    expect(ahvBeitrag(60_499, 2026).satz).toBe(9.321)
    expect(ahvBeitrag(80_000, 2026)).toMatchObject({ satz: 10, beitrag: 8000 })
  })
})

describe('estimateReserve', () => {
  it('adds income tax on profit after AHV contributions', () => {
    const r = estimateReserve(11_687.43, 2025, 25)
    expect(r.ahv.beitrag).toBe(627.73)
    expect(r.steuer).toBe(Math.round((11_687.43 - 627.73 - 31.39) * 0.25 * 100) / 100)
    expect(r.total).toBe(Math.round((627.73 + 31.39 + r.steuer) * 100) / 100)
  })
  it('is zero without profit', () => {
    expect(estimateReserve(0, 2026, 30).total).toBe(0)
  })
})
