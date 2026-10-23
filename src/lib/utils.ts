import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Erstes Geschäftsjahr = 2021 (älteste erfasste Rechnungen), davor gibt es keine Daten. */
export const FIRST_BUSINESS_YEAR = 2021

/** Jahre von `first` (Standard FIRST_BUSINESS_YEAR) bis heute, absteigend (neuestes zuerst). */
export function listBusinessYears(first = FIRST_BUSINESS_YEAR, now = new Date()): string[] {
  const currentYear = now.getFullYear()
  const count = Math.max(1, currentYear - first + 1)
  return Array.from({ length: count }, (_, i) => String(currentYear - i))
}

/** ISO-Datum (`2026-10-07` oder Zeitstempel) als `07.10.2026`; Unbekanntes bleibt unverändert. */
export function formatDatum(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso
}

/**
 * Vorname für die Anzeige: aus dem Benutzerprofil (first_name/full_name/name),
 * sonst aus dem Absendernamen, sonst aus dem Teil vor dem @ der E-Mail.
 */
export function displayFirstName(
  meta: Record<string, unknown> | null | undefined,
  absenderName: string | null | undefined,
  email: string | null | undefined,
): string {
  const first = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().split(/\s+/)[0] : '')
  const fromEmail = (email ?? '').split('@')[0].split(/[._-]/)[0]
  return first(meta?.first_name) || first(meta?.full_name) || first(meta?.name) || first(absenderName)
    || (fromEmail ? fromEmail[0].toUpperCase() + fromEmail.slice(1) : 'Angemeldet')
}

/** Cookie für die Breite der Admin-Seitenleiste ('schmal' | 'breit'). */
export const SIDEBAR_COOKIE = 'admin-sidebar'
