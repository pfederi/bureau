import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase/server'
import type { Currency, Expense, ExpenseCategory } from '@/lib/types'
import { EXPENSE_CATEGORIES } from '@/lib/expenses/categories'

export const RECEIPT_BUCKET = 'expense-receipts'
export const RECEIPT_TYPES: Record<string, string> = {
  'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic',
}
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024

const emptyToNull = (v: unknown) => (v === '' || v == null ? null : v)

const expenseSchema = z.object({
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  beschreibung: z.string().trim().min(1),
  lieferant: z.preprocess(emptyToNull, z.string().trim().nullable()).default(null),
  kategorie: z.enum(EXPENSE_CATEGORIES.map(c => c.value) as [ExpenseCategory, ...ExpenseCategory[]]),
  betrag: z.coerce.number().positive(),
  waehrung: z.enum(['CHF', 'EUR', 'USD'] as [Currency, ...Currency[]]).default('CHF'),
  betrag_original: z.preprocess(emptyToNull, z.coerce.number().positive().nullable()).default(null),
  beleg_path: z.preprocess(emptyToNull, z.string().nullable()).default(null),
  beleg_name: z.preprocess(emptyToNull, z.string().nullable()).default(null),
})
  // In Franken gibt es keinen Originalbetrag; in Fremdwährung ist er Pflicht.
  .transform(e => ({ ...e, betrag_original: e.waehrung === 'CHF' ? null : e.betrag_original }))
  .refine(e => e.waehrung === 'CHF' || e.betrag_original !== null, {
    message: 'Betrag in der Fremdwährung fehlt.', path: ['betrag_original'],
  })

export type ExpenseInput = z.infer<typeof expenseSchema>

export function parseExpenseForm(fd: FormData): ExpenseInput {
  return expenseSchema.parse(Object.fromEntries(fd.entries()))
}

export async function listExpenses(filter: { jahr?: string; kategorie?: ExpenseCategory } = {}): Promise<Expense[]> {
  const supabase = await createServerSupabase()
  let query = supabase.from('expenses').select('*').order('datum', { ascending: false }).order('created_at', { ascending: false })
  if (filter.jahr) query = query.gte('datum', `${filter.jahr}-01-01`).lt('datum', `${Number(filter.jahr) + 1}-01-01`)
  if (filter.kategorie) query = query.eq('kategorie', filter.kategorie)
  const { data, error } = await query
  if (error) throw error
  return data as Expense[]
}

export async function getExpense(id: string): Promise<Expense | null> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase.from('expenses').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Expense | null
}

export async function createExpense(input: ExpenseInput): Promise<void> {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('expenses').insert(input)
  if (error) throw error
}

/** Ersetzter Beleg wird im Speicher gelöscht. */
export async function updateExpense(id: string, input: ExpenseInput): Promise<void> {
  const supabase = await createServerSupabase()
  const old = await getExpense(id)
  const { error } = await supabase.from('expenses').update({ ...input, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
  if (old?.beleg_path && old.beleg_path !== input.beleg_path) {
    await supabase.storage.from(RECEIPT_BUCKET).remove([old.beleg_path])
  }
}

export async function deleteExpense(id: string): Promise<void> {
  const supabase = await createServerSupabase()
  const old = await getExpense(id)
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
  if (old?.beleg_path) await supabase.storage.from(RECEIPT_BUCKET).remove([old.beleg_path])
}
