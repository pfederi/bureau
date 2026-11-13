import { describe, it, expect } from 'vitest'
import { ladeMitGrenze } from '@/lib/inbound/download'

const strom = (teile: number[]) => new ReadableStream<Uint8Array>({
  start(c) { for (const n of teile) c.enqueue(new Uint8Array(n)); c.close() },
})

describe('ladeMitGrenze', () => {
  it('liest kleine Dateien vollständig', async () => {
    const bytes = await ladeMitGrenze(new Response(strom([3, 4])), 10)
    expect(bytes?.length).toBe(7)
  })
  it('bricht ab, wenn Content-Length zu gross ist, ohne zu lesen', async () => {
    const res = new Response(strom([5]), { headers: { 'content-length': '11' } })
    expect(await ladeMitGrenze(res, 10)).toBeNull()
  })
  it('bricht ab, sobald der Strom die Grenze überschreitet (ohne Content-Length)', async () => {
    expect(await ladeMitGrenze(new Response(strom([6, 6])), 10)).toBeNull()
  })
  it('leere Antwort: null', async () => {
    expect(await ladeMitGrenze(new Response(null), 10)).toBeNull()
  })
})
