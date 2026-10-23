import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth'
import { openEntriesForCustomer } from '@/lib/db/timeEntries'

export async function GET(request: NextRequest) {
  await requireSession()
  const customer = request.nextUrl.searchParams.get('customer')
  if (!customer) return NextResponse.json([])
  return NextResponse.json(await openEntriesForCustomer(customer))
}
