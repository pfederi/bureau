/** Edition dieser Installation (Bureau). */
export type Edition = {
  /** Anzeigename, z. B. Absender der Wochenmail */
  name: string
  /** Titel des Admin-Bereichs (Browser-Tab, Authenticator-App, Datensicherung) */
  adminTitel: string
  /** Kurzform für Dateinamen */
  slug: string
  logo: string
  favicon: string
  /** Fester Name auf der Kundenseite, null = Absender aus den Einstellungen */
  portalName: string | null
  /** Eigene Domain (Passkey-Hinweis, Fallback für APP_URL), null = keine feste Domain */
  domain: string | null
  htmlLang: 'de' | 'en'
  website: boolean
  material: boolean
  releaseNotes: boolean
}

export const edition: Edition = {
  name: 'Bureau',
  adminTitel: 'Bureau',
  slug: 'bureau',
  logo: '/apple-icon.png',
  favicon: '/favicon.ico',
  portalName: null,
  domain: null,
  htmlLang: 'de',
  website: false,
  material: false,
  releaseNotes: false,
}
