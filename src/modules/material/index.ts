import type { SupabaseClient } from '@supabase/supabase-js'
import type { CustomerCredit } from '@/lib/types'

/** Öffentliche Edition: keine Material-Verrechnung. Gleiche Exporte wie src/modules/material/index.ts. */
export async function listCredits(_customerId?: string): Promise<CustomerCredit[]> { return [] }
export async function listCreditsFor(_db: SupabaseClient, _customerId?: string): Promise<CustomerCredit[]> { return [] }
export async function syncCustomerAccount(_customerId: string): Promise<void> {}
export async function bucheZahlungAufsKonto(_input: { customer_id: string; datum: string; betrag: number; beschreibung: string }): Promise<{ abgeglichen: boolean }> {
  throw new Error('Keine Material-Verrechnung in dieser Edition.')
}
export function MaterialSection(_props: Record<string, unknown>) { return null }
export function PortalMaterialSection(_props: Record<string, unknown>) { return null }
export const MATERIAL_TABLES: readonly string[] = []
