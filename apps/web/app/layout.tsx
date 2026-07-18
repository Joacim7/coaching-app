import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CoachApp',
  description: 'Coaching platform for coaches and clients',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  )
}
