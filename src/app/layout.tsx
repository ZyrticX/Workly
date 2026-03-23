import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { Noto_Sans_Hebrew } from 'next/font/google'
import { ThemeProvider } from '@/components/ui/theme-provider'
import '@/lib/env'
import './globals.css'

const notoSansHebrew = Noto_Sans_Hebrew({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-noto-sans-hebrew',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#FFFFFF',
}

export const metadata: Metadata = {
  title: 'WhatsApp AI Agent - ניהול עסק חכם',
  description: 'פלטפורמת ניהול עסק עם סוכן AI בוואטסאפ',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AI Agent',
  },
  formatDetection: {
    telephone: false,
  },
}

// Default colors
const DEFAULT_PRIMARY = '#25D366'
const DEFAULT_PRIMARY_DARK = '#128C7E'
const DEFAULT_PRIMARY_LIGHT = '#DCF8E8'

function lightenHex(hex: string, ratio: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const lr = Math.round(r + (255 - r) * ratio)
  const lg = Math.round(g + (255 - g) * ratio)
  const lb = Math.round(b + (255 - b) * ratio)
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Read theme from cookie (available in SSR - no flash!)
  const cookieStore = await cookies()
  const themeCookie = cookieStore.get('wa-theme-primary')?.value
  const themeDarkCookie = cookieStore.get('wa-theme-dark')?.value

  const primary = themeCookie || DEFAULT_PRIMARY
  const primaryDark = themeDarkCookie || DEFAULT_PRIMARY_DARK
  const primaryLight = themeCookie ? lightenHex(primary, 0.9) : DEFAULT_PRIMARY_LIGHT

  // Inline style on <html> - renders with correct color from first byte
  const themeStyle = {
    '--color-primary': primary,
    '--color-primary-dark': primaryDark,
    '--color-primary-light': primaryLight,
  } as React.CSSProperties

  return (
    <html lang="he" dir="rtl" className={notoSansHebrew.variable} style={themeStyle}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider />
        {children}
      </body>
    </html>
  )
}
