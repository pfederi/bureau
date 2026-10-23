import { cn } from '@/lib/utils'

/** Roter Punkt, der beim Erscheinen dreimal pulsiert und dann ruhig bleibt (keine Dauerbewegung). */
export default function AlarmPunkt({ className }: { className?: string }) {
  return (
    <span className={cn('relative inline-flex h-2 w-2 shrink-0', className)} aria-hidden>
      <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-0 motion-safe:animate-puls-3" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-400" />
    </span>
  )
}
