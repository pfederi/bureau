import type { SupabaseClient } from '@supabase/supabase-js'
import type { CustomerCredit } from '@/lib/types'

/** Öffentliche Edition: keine Material-Verrechnung. Gleiche Exporte wie src/modules/material/index.ts. */
export async function listCredits(_customerId?: string): Promise<CustomerCredit[]> { return [] }
export async function listCreditsFor(_db: SupabaseClient, _customerId?: string): Promise<CustomerCredit[]> { return [] }
export async function syncCustomerAccount(_customerId: string): Promise<void> {}
export function MaterialSection(_props: Record<string, unknown>) { return null }
export function PortalMaterialSection(_props: Record<string, unknown>) { return null }
export const MATERIAL_TABLES: readonly string[] = []
