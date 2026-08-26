import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'genny', template: '%s · genny' },
  description: 'Open source generative media studio built on fal.',
  applicationName: 'genny',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'genny' },
}

export const viewport: Viewport = {
  themeColor: '#101215',
  // The studio behaves like an app: no accidental pinch-zoom while dragging a
  // slider, and the layout reaches under the notch.
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
