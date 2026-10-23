import React from 'react'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { edition } from '@/edition'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: edition.name,
  icons: {
    icon: edition.favicon,
    apple: edition.logo,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3B82F6', // blue-500
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang={edition.htmlLang} className="dark" data-scroll-behavior="smooth">
      <head>
        <link rel="icon" href={edition.favicon} sizes="any" />
        <link rel="apple-touch-icon" href={edition.logo} />
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                const savedDarkMode = localStorage.getItem('darkMode');
                if (savedDarkMode === 'false') {
                  document.documentElement.classList.remove('dark');
                } else {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {
                console.error('Error setting dark mode:', e);
              }
            })();
          `
        }} />
      </head>
      <body className={inter.className}>
        <main className="min-h-screen bg-white dark:bg-gray-900">
          {children}
        </main>
      </body>
    </html>
  )
} 