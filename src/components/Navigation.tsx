'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navigation() {
    const pathname = usePathname()

    const navItems = [
        { href: '/', label: '作成', icon: '🎙️' },
        { href: '/script', label: '台本', icon: '📝' },
        { href: '/library', label: '履歴', icon: '📚' },
        { href: '/settings', label: '設定', icon: '⚙️' },
    ]

    return (
        <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
            <div className="container mx-auto px-4 sm:px-8 max-w-4xl">
                <div className="flex items-center justify-between h-14">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2">
                        <span className="text-xl">🎙️</span>
                        <span className="font-bold text-gray-900">
                            スタエフ AI
                        </span>
                    </Link>

                    {/* Navigation Items */}
                    <div className="flex items-center gap-1">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`
                    flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                    transition-colors
                    ${isActive
                                            ? 'bg-orange-50 text-orange-600'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }
                  `}
                                >
                                    <span>{item.icon}</span>
                                    <span className="hidden sm:inline">{item.label}</span>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            </div>
        </nav>
    )
}
