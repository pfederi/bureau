#!/bin/bash
# PreToolUse-Hook (Bash): Vor jedem `git commit` den Kurz-Check laufen lassen (scripts/check.mjs:
# Typprüfung, Tests, npm audit, Login-Schutz, Migrationen, Geheimnisse, Aufräumen).
# Exit 2 blockiert den Commit; die Ausgabe auf stderr geht an Claude zurück.
cmd=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).tool_input?.command??"")}catch{}})')
printf '%s' "$cmd" | grep -Eq 'git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+commit' || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

if ! out=$(node scripts/check.mjs 2>&1); then
  echo "Commit blockiert: Kurz-Check (npm run check) fehlgeschlagen." >&2
  printf '%s\n' "$out" | tail -60 >&2
  exit 2
fi

exit 0
