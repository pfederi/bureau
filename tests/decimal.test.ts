import { describe, it, expect } from 'vitest'
import { normalizeDecimal } from '@/lib/decimal'

describe('normalizeDecimal', () => {
  it('turns a comma into a point', () => {
    expect(normalizeDecimal('12,50')).toBe('12.50')
    expect(normalizeDecimal('446.15')).toBe('446.15')
  })
  it('drops thousands separators and other characters', () => {
    expect(normalizeDecimal("1'234.50")).toBe('1234.50')
    expect(normalizeDecimal('1 234,5 Fr.')).toBe('1234.5')
  })
  it('keeps a single point and a leading minus', () => {
    expect(normalizeDecimal('1.2.3')).toBe('1.23')
    expect(normalizeDecimal('-0,5')).toBe('-0.5')
    expect(normalizeDecimal('5-')).toBe('5')
  })
  it('keeps partial input while typing', () => {
    expect(normalizeDecimal('12,')).toBe('12.')
    expect(normalizeDecimal('')).toBe('')
  })
})
