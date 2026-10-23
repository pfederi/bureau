import { edition } from '@/edition'

/** Öffentliche Adresse der App (hinter dem Proxy ist die eigene Adresse localhost). */
export function appUrl(): string {
  const fallback = edition.domain ? `https://${edition.domain}` : 'http://localhost:3000'
  return (process.env.APP_URL || fallback).replace(/\/$/, '')
}
