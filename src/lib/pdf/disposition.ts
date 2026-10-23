const UMLAUTE: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss' }

/** Dateiname ohne Endung, z. B. «RE-2026-OCT-16-43-0002_Muster-AG». */
export function invoiceFileBase(rechnungsnummer: string, kunde?: string | null): string {
  const name = (kunde ?? '')
    .replace(/[äöüÄÖÜß]/g, c => UMLAUTE[c])
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return name ? `${rechnungsnummer}_${name}` : rechnungsnummer
}

/** Content-Disposition für die PDF-Route: inline = Vorschau im Browser, sonst Download. */
export function pdfContentDisposition(fileBase: string, inline: boolean): string {
  const safe = fileBase.replace(/[^A-Za-z0-9._-]/g, '_')
  return `${inline ? 'inline' : 'attachment'}; filename="${safe}.pdf"`
}
