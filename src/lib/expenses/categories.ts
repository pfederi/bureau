import type { ExpenseCategory } from '@/lib/types'

/** Feste Kategorien, angelehnt an die Aufwandpositionen des Hilfsblatts A (Kanton Zürich). */
export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'material', label: 'Material und Waren' },
  { value: 'fremdleistungen', label: 'Fremdleistungen' },
  { value: 'software', label: 'Software und Abos' },
  { value: 'hosting', label: 'Hosting und Domains' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'buero', label: 'Büro und Kommunikation' },
  { value: 'reise', label: 'Reise und Fahrzeug' },
  { value: 'werbung', label: 'Werbung' },
  { value: 'weiterbildung', label: 'Weiterbildung' },
  { value: 'uebriges', label: 'Übriges' },
]

export const categoryLabel = (c: ExpenseCategory) => EXPENSE_CATEGORIES.find(x => x.value === c)?.label ?? c
