import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'
import type { Customer } from '@/lib/types'
import { addressLines } from '@/lib/address'

const emptyToNull = (v: unknown) => (v === '' || v == null ? null : v)
// <input type="month"> liefert YYYY-MM; gespeichert wird der Monatserste.
const monthToDate = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}$/.test(v) ? `${v}-01` : null)

const customerSchema = z.object({
  firma_oder_name: z.string().min(1),
  // mehrzeilig (Textarea liefert \r\n): einheitlich \n, Leerzeilen weg
  adresse: z.string().optional().default('').transform(v => addressLines(v).join('\n')),
  plz: z.string().optional().default(''),
  ort: z.string().optional().default(''),
  land: z.preprocess(v => (v === '' || v == null ? 'Schweiz' : v), z.string().min(1)),
  email: z.string().email().optional().or(z.literal('')).default(''),
  ansprechperson: z.string().optional().default(''),
  gruss: z.preprocess(v => (v === '' || v == null ? 'Freundliche Grüsse' : v), z.string().min(1)),
  hosting_text: z.preprocess(emptyToNull, z.string().nullable()).default(null),
  hosting_preis_monat: z.preprocess(emptyToNull, z.coerce.number().nonnegative().nullable()).default(null),
  hosting_ab: z.preprocess(monthToDate, z.string().nullable()).default(null),
  hosting_bis: z.preprocess(monthToDate, z.string().nullable()).default(null),
  stunden_budget: z.preprocess(emptyToNull, z.coerce.number().positive().nullable()).default(null),
  budget_zeitraum: z.preprocess(emptyToNull, z.enum(['monat', 'jahr']).nullable()).default(null),
}).transform(c => ({
  ...c,
  // Zeitraum nur zusammen mit einem Budget speichern; Standard ist pro Monat.
  budget_zeitraum: c.stunden_budget ? (c.budget_zeitraum ?? 'monat') : null,
})).refine(c => !c.hosting_ab || !c.hosting_bis || c.hosting_bis >= c.hosting_ab, {
  message: 'Hosting «aktiv bis» liegt vor «aktiv ab».', path: ['hosting_bis'],
})

export type CustomerInput = z.infer<typeof customerSchema>

export function parseCustomerForm(fd: FormData): CustomerInput {
  return customerSchema.parse(Object.fromEntries(fd.entries()))
}

export async function listCustomers(): Promise<Customer[]> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase.from('customers').select('*').order('kundennummer')
  if (error) throw error
  return data as Customer[]
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Customer | null
}

export async function createCustomer(input: CustomerInput): Promise<void> {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('customers').insert(input)
  if (error) throw error
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<void> {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('customers').update(input).eq('id', id)
  if (error) throw error
}

export async function deleteCustomer(id: string): Promise<void> {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) throw error
}
