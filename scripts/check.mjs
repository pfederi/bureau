#!/usr/bin/env node
/**
 * Kurz-Check vor jedem Commit/Ship (npm run check): Typen, Tests, Abhängigkeiten, Login-Schutz,
 * Migrationen, Geheimnisse im Browser-Code und Aufräumen. Meldet am Ende, ob sicherheitsrelevante
 * Dateien geändert wurden (dann im /ship ein kurzes Review des Diffs).
 *
 *   node scripts/check.mjs            alles
 *   node scripts/check.mjs --ohne-tests   ohne tsc/vitest (z. B. wenn sie gerade liefen)
 *
 * Exit 1 bei Fehlern, Hinweise brechen nicht ab.
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const ohneTests = process.argv.includes('--ohne-tests')
const fehler = []
const hinweise = []
const lesen = f => readFileSync(join(ROOT, f), 'utf8')
const rel = f => relative(ROOT, f)

function dateien(dir, filter) {
  const out = []
  const walk = d => {
    for (const name of readdirSync(d)) {
      const p = join(d, name)
      if (statSync(p).isDirectory()) { if (name !== 'node_modules' && !name.startsWith('.')) walk(p) }
      else if (filter(p)) out.push(rel(p))
    }
  }
  if (existsSync(join(ROOT, dir))) walk(join(ROOT, dir))
  return out
}

function lauf(titel, cmd) {
  const t0 = Date.now()
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' })
    console.log(`✓ ${titel} (${((Date.now() - t0) / 1000).toFixed(1)} s)`)
  } catch (e) {
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`.split('\n').filter(l => !/CJS build of Vite/.test(l))
    fehler.push(`${titel} fehlgeschlagen:\n${out.slice(-30).join('\n')}`)
    console.log(`✗ ${titel}`)
  }
}

const ohneKommentare = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

/**
 * Alle exportierten Werte einer Datei als [name, body]: `export (default) (async) function x`
 * und `export const x = …`. Der Körper reicht bis zum Ende der Deklaration (Zeile mit } am
 * Zeilenanfang), Kommentare sind entfernt – ein requireSession() im Kommentar zählt nicht.
 */
function exporte(src) {
  const code = ohneKommentare(src)
  const treffer = [...code.matchAll(/^export\s+(?:default\s+)?(?:(?:async\s+)?function\s+(\w+)|(?:const|let)\s+(\w+))/gm)]
  return treffer.map(m => {
    const rest = code.slice(m.index)
    const ende = rest.search(/\n\}[^\n]*(\n|$)/)
    return [m[1] ?? m[2], ende === -1 ? rest : rest.slice(0, ende + 2)]
  })
}

// 1 Typen und Tests
if (!ohneTests) {
  lauf('Typprüfung', 'npx tsc --noEmit --incremental false')
  lauf('Tests', 'npx vitest run')
}

// 2 Abhängigkeiten
try {
  let json
  try { json = execSync('npm audit --omit=dev --json', { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' }) }
  catch (e) { json = e.stdout } // npm audit endet mit Code 1, sobald es Funde gibt
  const v = JSON.parse(json).metadata?.vulnerabilities ?? {}
  if ((v.high ?? 0) + (v.critical ?? 0) > 0) fehler.push(`npm audit: ${v.critical ?? 0} kritisch, ${v.high ?? 0} hoch – «npm audit --omit=dev» ansehen`)
  else if ((v.moderate ?? 0) + (v.low ?? 0) > 0) hinweise.push(`npm audit: ${v.moderate ?? 0} mittel, ${v.low ?? 0} niedrig`)
  console.log('✓ Abhängigkeiten (npm audit)')
} catch {
  hinweise.push('npm audit nicht möglich (offline?) – übersprungen')
}

// 3 Login-Schutz: Routen und Server-Aktionen
const OEFFENTLICH = [
  // Pfad-Präfix → nötige Prüfung statt requireSession
  ['src/app/api/cron/', /cronAuthorized\(/, 'cronAuthorized()'],
  ['src/app/kunde/', /getPortal(Invoice|Customer)\(|loadPortal\(/, 'Kundenlink-Token'],
]
const HANDLER = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/
for (const f of dateien('src/app', p => p.endsWith('/route.ts'))) {
  const regel = OEFFENTLICH.find(([pfad]) => f.startsWith(pfad))
  for (const [name, body] of exporte(lesen(f)).filter(([n]) => HANDLER.test(n))) {
    const ok = regel ? regel[1].test(body) : /await\s+requireSession\(/.test(body)
    if (!ok) fehler.push(`${f}: ${name} ohne ${regel ? regel[2] : 'requireSession()'}`)
  }
}
const serverDateien = dateien('src', p => /\.(ts|tsx)$/.test(p)).filter(f => /^\s*['"]use server['"]/.test(lesen(f)))
for (const f of serverDateien) {
  for (const [name, body] of exporte(lesen(f))) {
    // Die erste Aktion muss die Anmeldung prüfen – vor jedem anderen await
    const erstesAwait = body.match(/await\s+([\w.]+)\(/)
    if (erstesAwait?.[1] !== 'requireSession') fehler.push(`${f}: Server-Aktion ${name} prüft die Anmeldung nicht zuerst (requireSession)`)
  }
}
for (const f of dateien('src', p => /\.(ts|tsx)$/.test(p)).filter(f => !serverDateien.includes(f))) {
  const src = lesen(f)
  for (const m of src.matchAll(/['"]use server['"]/g)) {
    const body = src.slice(m.index, m.index + 400)
    if (!/signOut\(/.test(body) && !/requireSession\(/.test(body)) fehler.push(`${f}: Inline-Server-Aktion ohne requireSession()`)
  }
}
console.log('✓ Login-Schutz (Routen, Server-Aktionen)')

// 4 Migrationen: RLS und Rechte
// Bewusst ohne Policy: nur über security-definer-Funktionen (is_admin_user, has_admin_access) lesbar
const OHNE_POLICY = ['admin_users']
const migrationen = readdirSync(join(ROOT, 'supabase'), { withFileTypes: true })
  .filter(e => e.isDirectory() && !e.name.startsWith('.'))
  .flatMap(e => dateien(`supabase/${e.name}`, p => p.endsWith('.sql')))
  .sort((a, b) => a.split('/').pop().localeCompare(b.split('/').pop()))
const alleSql = migrationen.map(lesen).join('\n').toLowerCase()
for (const f of migrationen) {
  const sql = lesen(f).toLowerCase()
  for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)/g)) {
    const t = m[1]
    if (!new RegExp(`alter\\s+table\\s+(?:public\\.)?${t}\\s+enable\\s+row\\s+level\\s+security`).test(alleSql)) fehler.push(`${f}: Tabelle ${t} ohne RLS`)
    if (!OHNE_POLICY.includes(t) && !new RegExp(`create\\s+policy\\s+[^;]*\\son\\s+(?:public\\.)?${t}\\b`).test(alleSql)) fehler.push(`${f}: Tabelle ${t} ohne Policy`)
  }
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(\w+)/g)) {
    if (!new RegExp(`revoke\\s+(?:all|execute)[^;]*function\\s+(?:public\\.)?${m[1]}\\b[^;]*from[^;]*anon`).test(alleSql)) fehler.push(`${f}: Funktion ${m[1]} ohne «revoke execute … from anon»`)
  }
}
for (const f of migrationen) {
  const sql = lesen(f).toLowerCase().replace(/--.*$/gm, '')
  for (const m of sql.matchAll(/grant\s+([^;]*?)\s+to\s+([^;]*)/g)) {
    const erlaubt = /^select\s+on\s+(table\s+)?(public\.)?projects$/.test(m[1].trim())
    if (/\b(anon|public)\b/.test(m[2]) && !erlaubt) fehler.push(`${f}: «grant ${m[1].trim()} to ${m[2].trim()}» – Rechte für anon/public prüfen`)
  }
  if (/disable\s+row\s+level\s+security/.test(sql)) fehler.push(`${f}: schaltet RLS ab`)
}
console.log('✓ Migrationen (RLS, Policies, Funktionsrechte)')

// 5 Geheimnisse und Server-Code im Browser
const VERBOTEN = [/@\/lib\/supabase\/(admin|server)/, /@\/lib\/db\//, /@\/lib\/(email|pdf|cron)\//, /@\/lib\/portal\/token/, /@\/lib\/monitoring\/(check|run)/, /from '(node:)?(fs|crypto|child_process|tls|dns)(\/promises)?'/]
for (const f of dateien('src', p => /\.(ts|tsx)$/.test(p))) {
  const src = lesen(f)
  if (!/^\s*['"]use client['"]/.test(src)) continue
  // Ganze Import-Anweisungen, auch mehrzeilige; reine Typ-Importe verschwinden beim Bauen
  for (const m of ohneKommentare(src).matchAll(/^\s*import\s+(?!type\s)(?:[\s\S]*?\sfrom\s+)?(['"])([^'"]+)\1/gm)) {
    const ziel = `from '${m[2]}'`
    if (VERBOTEN.some(r => r.test(ziel))) fehler.push(`${f}: Browser-Code importiert Server-Modul ${m[2]}`)
  }
  for (const m of src.matchAll(/process\.env\.(\w+)/g)) if (!m[1].startsWith('NEXT_PUBLIC_')) fehler.push(`${f}: Browser-Code liest process.env.${m[1]}`)
}
const getrackt = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n')
for (const f of getrackt.filter(f => /(^|\/)\.env($|\.)/.test(f) && !f.endsWith('.example'))) fehler.push(`${f}: Umgebungsdatei ist im Git`)
console.log('✓ Geheimnisse (Browser-Code, .env)')

// 6 Aufräumen und Altlasten
for (const f of dateien('tests', p => /tmp/.test(p))) fehler.push(`${f}: temporäre Testdatei`)
if (existsSync(join(ROOT, 'supabase/.temp'))) fehler.push('supabase/.temp vorhanden')
const fremdeRegistry = [...lesen('package-lock.json').matchAll(/"resolved": "(https?:\/\/[^/"]+)/g)]
  .map(m => m[1]).filter(h => h !== 'https://registry.npmjs.org')
if (fremdeRegistry.length) fehler.push(`package-lock.json verweist auf fremde Registry: ${[...new Set(fremdeRegistry)].join(', ')}`)
const ALT_TW = /\b(?:bg|text|border|divide|ring|placeholder)-opacity-\d+|\bflex-(?:grow|shrink)\b|\boverflow-ellipsis\b|\bdecoration-(?:slice|clone)\b/
for (const f of dateien('src', p => /\.(tsx|ts)$/.test(p))) {
  const src = lesen(f)
  const m = src.match(ALT_TW)
  if (m) fehler.push(`${f}: veraltete Tailwind-3-Klasse «${m[0]}» (in Tailwind 4 wirkungslos)`)
  if (src.includes('dangerouslySetInnerHTML') && f !== 'src/app/layout.tsx') hinweise.push(`${f}: dangerouslySetInnerHTML – Inhalt geprüft?`)
}
console.log('✓ Aufräumen (Testdateien, Registry, Tailwind-Altlasten)')

// 7 Sicherheitsrelevante Änderungen → Review empfehlen
const geaendert = [
  // Ohne HEAD (leeres Repo, z. B. erster Export von Bureau) gibt es nichts zu vergleichen
  ...(() => { try { return execSync('git diff --name-only HEAD', { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }).split('\n') } catch { return [] } })(),
  ...execSync('git ls-files --others --exclude-standard', { cwd: ROOT, encoding: 'utf8' }).split('\n'),
].filter(Boolean)
const RELEVANT = [/\/route\.ts$/, /actions\.ts$/, /^src\/lib\/auth\.ts$/, /^src\/proxy\.ts$/, /^src\/lib\/supabase\//, /^supabase\//,
  /^src\/app\/kunde\//, /^src\/lib\/(portal|cron|monitoring|email|export)\//, /^src\/lib\/db\/portal\.ts$/, /^next\.config\.js$/, /^package\.json$/]
const relevant = [...new Set(geaendert.filter(f => RELEVANT.some(r => r.test(f)) || serverDateien.includes(f)))]

console.log('')
for (const h of hinweise) console.log(`Hinweis: ${h}`)
if (fehler.length) {
  console.log(`\n${fehler.length} Fehler:`)
  for (const f of fehler) console.log(`  ✗ ${f}`)
}
console.log(relevant.length
  ? `\nREVIEW EMPFOHLEN – sicherheitsrelevante Dateien geändert:\n${relevant.map(f => `  - ${f}`).join('\n')}`
  : '\nREVIEW: nicht nötig (keine sicherheitsrelevanten Dateien geändert)')
console.log(fehler.length ? '\nCheck fehlgeschlagen.' : '\nCheck bestanden.')
process.exit(fehler.length ? 1 : 0)
