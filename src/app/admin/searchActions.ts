'use server'
import { requireSession } from '@/lib/auth'
import { searchAll, type SearchHit } from '@/lib/db/search'

export async function searchAction(q: string): Promise<SearchHit[]> {
  await requireSession()
  return searchAll(q)
}
