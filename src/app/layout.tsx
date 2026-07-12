import type { Metadata, Viewport } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'
import PwaRegistration from '@/components/PwaRegistration'

export const metadata: Metadata = {
    title: 'スタエフ AIアシスタント',
    description: 'stand.fm配信者のための音声コンテンツ自動化ツール',
    manifest: '/manifest.json',
    icons: {
        icon: '/icon.svg',
        apple: '/icon.svg',
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'スタエフ AI',
    },
}

export const viewport: Viewport = {
    themeColor: '#1a1b1d',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="ja">
            <body className="font-sans antialiased">
                <div className="flex flex-col min-h-screen">
                    <Navigation />
                    <main className="flex-1 container mx-auto px-4 sm:px-8 py-6 max-w-4xl">
                        {children}
                    </main>
                    <div className="safe-area-bottom" />
                </div>
                <PwaRegistration />
            </body>
        </html>
    )
}
