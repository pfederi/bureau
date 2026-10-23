import { describe, it, expect } from 'vitest'
import { pdfContentDisposition, invoiceFileBase } from '@/lib/pdf/disposition'

describe('pdfContentDisposition', () => {
  it('uses attachment for downloads', () => {
    expect(pdfContentDisposition('RE-2026-JUL-24-42-0001', false))
      .toBe('attachment; filename="RE-2026-JUL-24-42-0001.pdf"')
  })

  it('uses inline for the preview', () => {
    expect(pdfContentDisposition('RE-2026-JUL-24-42-0001', true))
      .toBe('inline; filename="RE-2026-JUL-24-42-0001.pdf"')
  })

  it('strips characters that would break the header', () => {
    expect(pdfContentDisposition('RE "2026"; rm -rf', false))
      .toBe('attachment; filename="RE__2026___rm_-rf.pdf"')
  })
})

describe('invoiceFileBase', () => {
  it('appends the customer name in a filename-safe form', () => {
    expect(invoiceFileBase('RE-2026-OCT-16-43-0002', 'Muster AG')).toBe('RE-2026-OCT-16-43-0002_Muster-AG')
    expect(invoiceFileBase('RE-1', 'Muster & Söhne GmbH')).toBe('RE-1_Muster-Soehne-GmbH')
    expect(invoiceFileBase('RE-1', 'Café Zürichsee')).toBe('RE-1_Cafe-Zuerichsee')
  })
  it('falls back to the invoice number without a name', () => {
    expect(invoiceFileBase('RE-1', '')).toBe('RE-1')
    expect(invoiceFileBase('RE-1', null)).toBe('RE-1')
  })
})
