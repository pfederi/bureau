/** Sicherheits-Header für alle Seiten (CSP nur frame-ancestors: Next.js und die Website nutzen Inline-Skripte). */
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Gegen Clickjacking; eigene Seiten dürfen sich einbetten (PDF-Vorschau im Admin)
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'" },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Projektordner fest: sonst nimmt Turbopack eine package-lock.json weiter oben als Wurzel
  turbopack: { root: __dirname },
  images: {
    unoptimized: true,
  },
  // pdfkit (and swissqrbill/fontkit which use it) load font data files from disk
  // at runtime; bundling them breaks that (ENOENT Helvetica.afm). Keep external.
  serverExternalPackages: ['pdfkit', 'swissqrbill', 'fontkit', 'unpdf'],
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Admin und Kundenlink: nie in Suchmaschinen, Kundenlink-Token nie als Referrer weitergeben
      { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/kunde/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Referrer-Policy', value: 'no-referrer' }] },
    ]
  },
}

module.exports = nextConfig
