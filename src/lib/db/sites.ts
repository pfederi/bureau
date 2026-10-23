import { createServerSupabase } from '@/lib/supabase/server'
import type { MonitoredSite } from '@/lib/monitoring/sites'

export async function listSites(customerId?: string): Promise<MonitoredSite[]> {
  const supabase = await createServerSupabase()
  let query = supabase.from('monitored_sites').select('*').order('created_at')
  if (customerId) query = query.eq('customer_id', customerId)
  const { data, error } = await query
  if (error) throw error
  return data as MonitoredSite[]
}
