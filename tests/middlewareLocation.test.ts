import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import path from 'path'

// Regression guard: this project keeps its app under `src/`, so Next.js only
// loads the proxy (ab Next 16, früher «middleware») from `src/proxy.ts`. A file at
// the repo root is silently IGNORED — which disables all /admin auth protection.
const root = path.resolve(__dirname, '..')

describe('proxy location', () => {
  it('lives in src/ and exports `proxy`, so Next.js actually loads it', () => {
    const file = path.join(root, 'src/proxy.ts')
    expect(existsSync(file)).toBe(true)
    expect(readFileSync(file, 'utf8')).toMatch(/export async function proxy\(/)
  })
  it('has no leftover or root-level middleware/proxy file', () => {
    for (const f of ['middleware.ts', 'proxy.ts', 'src/middleware.ts']) expect(existsSync(path.join(root, f)), f).toBe(false)
  })
})
