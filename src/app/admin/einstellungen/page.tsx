import { getSettings } from '@/lib/db/settings'
import SettingsForm from './SettingsForm'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Archive } from 'lucide-react'
import { createServerSupabase } from '@/lib/supabase/server'
import TwoFactorSettings, { type DeviceFactor } from './TwoFactorSettings'
import PasswordForm from './PasswordForm'
import { backupBeschreibung } from '@/lib/export/backup'

export const metadata = { title: 'Einstellungen' }

const fields: { name: string; label: string; type?: string }[] = [
  { name: 'absender_name', label: 'Absender Name' },
  { name: 'absender_adresse', label: 'Adresse' },
  { name: 'absender_plz_ort', label: 'PLZ / Ort' },
  { name: 'absender_land', label: 'Land' },
  { name: 'absender_tel', label: 'Telefon' },
  { name: 'absender_email', label: 'E-Mail', type: 'email' },
  { name: 'bank_name', label: 'Bank' },
  { name: 'iban', label: 'IBAN' },
  { name: 'standard_stundensatz', label: 'Standard-Stundensatz (Fr.)', type: 'number' },
  { name: 'mwst_hinweis', label: 'MWST-Hinweis' },
  { name: 'grenzsteuersatz', label: 'Grenzsteuersatz (%) für die Rücklage', type: 'number' },
]

export default async function EinstellungenPage() {
  const s = await getSettings()
  const { data: { user } } = await (await createServerSupabase()).auth.getUser()
  const factors: DeviceFactor[] = (user?.factors ?? [])
    .filter(f => f.status === 'verified' && (f.factor_type === 'totp' || f.factor_type === 'webauthn'))
    .map(f => ({ id: f.id, name: f.friendly_name || (f.factor_type === 'webauthn' ? 'Passkey' : 'Authenticator-App'), created_at: f.created_at, typ: f.factor_type as 'totp' | 'webauthn' }))
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Einstellungen</h1>
        <p className="text-sm text-muted-foreground">Absender-, Bank- und Rechnungsangaben, Datensicherung, Passwort und Zwei-Faktor-Anmeldung.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Angaben</CardTitle>
          <CardDescription>Diese Angaben erscheinen auf jeder Rechnung.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map(f => (
              <div key={f.name} className="space-y-1.5">
                <Label htmlFor={f.name}>{f.label}</Label>
                {f.type === 'number'
                  ? <DecimalInput id={f.name} name={f.name} defaultValue={String((s as any)[f.name] ?? '')} />
                  : <Input id={f.name} name={f.name} type={f.type ?? 'text'} defaultValue={String((s as any)[f.name] ?? '')} />}
              </div>
            ))}
          </SettingsForm>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datensicherung</CardTitle>
          <CardDescription>
            {backupBeschreibung()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <a href="/api/admin/export" download><Archive className="h-4 w-4 mr-1.5" />Datensicherung herunterladen</a>
          </Button>
        </CardContent>
      </Card>
      {/* Sicherheit: Passwort und Zwei-Faktor nebeneinander */}
      <div className="grid items-start gap-6 lg:grid-cols-2 *:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Passwort</CardTitle>
            <CardDescription>Zum Ändern brauchst du dein aktuelles Passwort. Du bleibst danach angemeldet.</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm email={user?.email ?? ''} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Zwei-Faktor-Anmeldung</CardTitle>
            <CardDescription>Geräte, deren Code bei der Anmeldung gilt. Jedes eingerichtete Gerät funktioniert für sich allein.</CardDescription>
          </CardHeader>
          <CardContent>
            <TwoFactorSettings factors={factors} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
