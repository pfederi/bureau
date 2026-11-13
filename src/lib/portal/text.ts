export type Anrede = 'sie' | 'du'

/** Texte im Kundenlink, die den Kunden direkt ansprechen (Anrede pro Kunde). */
export function portalText(anrede: Anrede) {
  return anrede === 'du'
    ? {
        name: 'Dein Name',
        neueOfferte: 'Melde dich für eine neue Offerte.',
        angenommenDank: 'Vielen Dank, deine Zusage ist angekommen.',
        abgelehntDank: 'Danke für deine Rückmeldung.',
      }
    : {
        name: 'Ihr Name',
        neueOfferte: 'Bitte melden Sie sich für eine neue Offerte.',
        angenommenDank: 'Vielen Dank, Ihre Zusage ist bei uns angekommen.',
        abgelehntDank: 'Danke für Ihre Rückmeldung.',
      }
}
