import type { InvoiceStatus } from '@/lib/types'

export type StatusAction = 'send' | 'markPaid' | 'markUnpaid'

export function nextStatus(current: InvoiceStatus, action: StatusAction): InvoiceStatus {
  switch (action) {
    case 'send': return 'versendet'
    case 'markPaid': return 'bezahlt'
    case 'markUnpaid': return 'versendet'
  }
}
