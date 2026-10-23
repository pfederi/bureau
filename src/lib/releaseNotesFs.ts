import { readdir, readFile } from 'fs/promises'
import path from 'path'
import { compareVersionsDesc, parseReleaseNote, type ReleaseNote } from '@/lib/releaseNotes'
import type { EffortFile } from '@/lib/effort'

const DIR = path.join(process.cwd(), 'docs', 'release-notes')

/** Alle Release Notes, neueste Version zuerst. */
export async function loadReleaseNotes(): Promise<ReleaseNote[]> {
  const files = (await readdir(DIR)).filter(f => /^v\d+\.\d+\.\d+\.md$/.test(f))
  const notes = await Promise.all(files.map(async f => parseReleaseNote(await readFile(path.join(DIR, f), 'utf8'))))
  return notes.sort((a, b) => compareVersionsDesc(a.version, b.version))
}

/** Zeitaufwand pro Version (scripts/aufwand.mjs); fehlt die Datei, gibt es keine Angaben. */
export async function loadEffort(): Promise<EffortFile | null> {
  try {
    return JSON.parse(await readFile(path.join(DIR, 'aufwand.json'), 'utf8')) as EffortFile
  } catch {
    return null
  }
}

/** Anleitung aus docs/anleitung.md. */
export async function loadGuide(): Promise<string> {
  return readFile(path.join(process.cwd(), 'docs', 'anleitung.md'), 'utf8')
}
