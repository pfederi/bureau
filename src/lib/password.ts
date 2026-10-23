export const MIN_PASSWORD_LENGTH = 10

/** Prüft das neue Passwort vor dem Speichern; gibt eine Fehlermeldung oder null zurück. */
export function validateNewPassword(aktuell: string, neu: string, wiederholung: string): string | null {
  if (!aktuell) return 'Bitte gib dein aktuelles Passwort ein.'
  if (neu.length < MIN_PASSWORD_LENGTH) return `Das neue Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`
  if (neu !== wiederholung) return 'Die beiden neuen Passwörter stimmen nicht überein.'
  if (neu === aktuell) return 'Das neue Passwort muss sich vom aktuellen unterscheiden.'
  return null
}
