import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '당직표',
  description: '고대안산병원 PA 당직 관리 시스템',
  manifest: '/manifest.json?v=1',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '당직표',
  },
  icons: {
    apple: [{ url: '/icon-512x512.png?v=1', sizes: '512x512', type: 'image/png' }],
    icon: [
      { url: '/icon-192x192.png?v=1', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png?v=1', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/icon-192x192.png?v=1',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#3182f6',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512x512.png?v=1" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192x192.png?v=1" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192x192.png?v=1" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512x512.png?v=1" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="당직표" />
        <link rel="manifest" href="/manifest.json?v=1" />
      </head>
      <body>{children}</body>
    </html>
  )
}
