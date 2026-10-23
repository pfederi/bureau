import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'
import type { TimeEntry } from '@/lib/types'

const timeEntrySchema = z.object({
  customer_id: z.string().uuid(),
  datum: z.string().min(1),
  beschreibung: z.string().min(1),
  stunden: z.coerce.number().positive(),
  stundensatz: z.coerce.number().nonnegative(),
  projekt: z.string().optional().transform(v => v?.trim() || null),
})

export type TimeEntryInput = z.infer<typeof timeEntrySchema>

export function parseTimeEntryForm(fd: FormData): TimeEntryInput {
  return timeEntrySchema.parse(Object.fromEntries(fd.entries()))
}

export type TimeEntryStatusFilter = 'offen' | 'verrechnet' | 'alle'

/** Alle bisher verwendeten Projektnamen, alphabetisch (Vorschläge im Formular). */
export async function listProjectNames(): Promise<string[]> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase.from('time_entries').select('projekt').not('projekt', 'is', null)
  if (error) throw error
  return Array.from(new Set((data as { projekt: string }[]).map(r => r.projekt))).sort((a, b) => a.localeCompare(b, 'de'))
}

export async function listTimeEntries(
  filter: { status?: TimeEntryStatusFilter; customerId?: string; jahr?: string } = {},
): Promise<(TimeEntry & { customer: { firma_oder_name: string } })[]> {
  const supabase = await createServerSupabase()
  let query = supabase
    .from('time_entries')
    .select('*, customer:customers(firma_oder_name)')
    .order('datum', { ascending: false })
  if (filter.status === 'offen') query = query.eq('billed', false)
  if (filter.status === 'verrechnet') query = query.eq('billed', true)
  if (filter.customerId) query = query.eq('customer_id', filter.customerId)
  if (filter.jahr) {
    query = query.gte('datum', `${filter.jahr}-01-01`).lt('datum', `${Number(filter.jahr) + 1}-01-01`)
  }
  const { data, error } = await query
  if (error) throw error
  return data as (TimeEntry & { customer: { firma_oder_name: string } })[]
}

export async function openEntriesForCustomer(customerId: string): Promise<TimeEntry[]> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .eq('customer_id', customerId)
    .eq('billed', false)
    .order('datum')
  if (error) throw error
  return data as TimeEntry[]
}

export async function createTimeEntry(input: TimeEntryInput): Promise<void> {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('time_entries').insert({ ...input, billed: false })
  if (error) throw error
}

export async function updateTimeEntry(id: string, input: TimeEntryInput): Promise<void> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('time_entries')
    .update(input)
    .eq('id', id)
    .eq('billed', false)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Eintrag ist bereits abgerechnet oder existiert nicht.')
}

export async function deleteTimeEntry(id: string): Promise<void> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('time_entries')
    .delete()
    .eq('id', id)
    .eq('billed', false)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Eintrag ist bereits abgerechnet oder existiert nicht.')
}
