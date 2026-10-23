'use client'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { INAKTIV_MS, LEBENSZEICHEN_MS, WARNUNG_MS } from '@/lib/sitzung'

// Letzte Eingabe über alle offenen Admin-Tabs (Arbeit im einen Tab hält die anderen wach)
const SPEICHER = 'ls-admin-eingabe'
// kein `scroll`: feuert auch bei Scrollen per Skript (Fokus, scrollIntoView)
const EREIGNISSE = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const
const WARNUNG = 'sitzung-warnung'

/**
 * Meldet nach 15 Minuten ohne Eingabe ab (eine Minute vorher mit Hinweis) und schickt jede
 * Minute ein Lebenszeichen, damit der Server merkt, wenn die Seite geschlossen wurde.
 * Der Server prüft dasselbe (src/proxy.ts) – das hier sorgt nur für die sichtbare Abmeldung.
 */
export default function SitzungsWaechter() {
  useEffect(() => {
    let eingabe = Date.now()
    let gemeldet = 0
    let gewarnt = false
    let beendet = false

    const letzteEingabe = () => {
      try { return Math.max(eingabe, Number(localStorage.getItem(SPEICHER)) || 0) } catch { return eingabe }
    }
    const merken = () => {
      eingabe = Date.now()
      try { localStorage.setItem(SPEICHER, String(eingabe)) } catch { /* privates Fenster */ }
    }
    const onEingabe = () => {
      if (Date.now() - eingabe < 2000) return // Mausbewegungen nicht dauernd speichern
      merken()
      if (gewarnt) { gewarnt = false; toast.dismiss(WARNUNG) }
    }

    const zurAnmeldung = (grund: string) => {
      if (beendet) return
      beendet = true
      window.location.replace(`/admin/login?grund=${grund}`)
    }

    async function lebenszeichen() {
      if (beendet) return
      const start = Date.now()
      const aktiv = letzteEingabe() > gemeldet
      try {
        const res = await fetch(`/api/admin/sitzung${aktiv ? '?aktiv=1' : ''}`, { method: 'POST', redirect: 'manual', cache: 'no-store' })
        // Umleitung zur Anmeldung: Server hat die Sitzung beendet (z. B. Laptop lange zugeklappt)
        if (res.type === 'opaqueredirect' || res.status === 401) return zurAnmeldung('abgemeldet')
        if (res.ok && aktiv) gemeldet = start
      } catch { /* offline: nächster Versuch in einer Minute */ }
    }

    async function pruefen() {
      if (beendet) return
      const still = Date.now() - letzteEingabe()
      if (still >= INAKTIV_MS) {
        beendet = true
        toast.dismiss(WARNUNG)
        await fetch('/api/admin/sitzung?ende=1', { method: 'POST', redirect: 'manual' }).catch(() => null)
        window.location.replace('/admin/login?grund=inaktiv')
      } else if (still >= INAKTIV_MS - WARNUNG_MS) {
        if (gewarnt) return
        gewarnt = true
        toast.warning('Du wirst in einer Minute abgemeldet', {
          id: WARNUNG,
          description: 'Seit fast 15 Minuten keine Aktivität.',
          duration: Infinity,
          action: { label: 'Angemeldet bleiben', onClick: () => { merken(); gewarnt = false } },
        })
      } else if (gewarnt) {
        // Eingabe in einem anderen Tab
        gewarnt = false
        toast.dismiss(WARNUNG)
      }
    }

    const wiederDa = () => {
      if (document.visibilityState !== 'visible') return
      void pruefen()
      void lebenszeichen()
    }
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) wiederDa() }

    EREIGNISSE.forEach(e => window.addEventListener(e, onEingabe, { passive: true, capture: true }))
    document.addEventListener('visibilitychange', wiederDa)
    window.addEventListener('pageshow', onPageShow)
    merken()
    const t1 = setInterval(() => void pruefen(), 5000)
    const t2 = setInterval(() => void lebenszeichen(), LEBENSZEICHEN_MS)
    return () => {
      beendet = true
      EREIGNISSE.forEach(e => window.removeEventListener(e, onEingabe, { capture: true }))
      document.removeEventListener('visibilitychange', wiederDa)
      window.removeEventListener('pageshow', onPageShow)
      clearInterval(t1)
      clearInterval(t2)
    }
  }, [])

  return null
}
