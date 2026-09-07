import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = { title: 'signal/ats — Resume match, made explainable', description: 'A private, transparent ATS resume analyzer that shows what matched and what to improve.', generator: 'signal/ats' }
export const viewport: Viewport = { colorScheme: 'light', themeColor: '#f7f8f5', width: 'device-width', initialScale: 1 }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en" className="bg-background"><body>{children}</body></html> }
