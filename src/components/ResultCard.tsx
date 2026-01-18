'use client'

import { useState } from 'react'
import CopyButton from './CopyButton'

interface ResultCardProps {
    title?: string
    content: string
    icon?: string
    highlight?: boolean
    compact?: boolean
    collapsible?: boolean
    defaultCollapsed?: boolean
}

export default function ResultCard({
    title,
    content,
    icon,
    highlight = false,
    compact = false,
    collapsible = false,
    defaultCollapsed = false,
}: ResultCardProps) {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)

    const cardClass = `
    rounded-xl overflow-hidden border
    ${highlight ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'}
    ${compact ? 'p-3' : 'p-4'}
  `

    if (compact) {
        return (
            <div className={cardClass}>
                <div className="flex items-start gap-3">
                    <p className="flex-1 text-sm text-gray-700 whitespace-pre-wrap">{content}</p>
                    <CopyButton text={content} />
                </div>
            </div>
        )
    }

    return (
        <div className={cardClass}>
            {/* Header */}
            {title && (
                <div
                    className={`flex items-center justify-between mb-3 ${collapsible ? 'cursor-pointer' : ''}`}
                    onClick={() => collapsible && setIsCollapsed(!isCollapsed)}
                >
                    <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                        {icon && <span>{icon}</span>}
                        <span>{title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <CopyButton text={content} />
                        {collapsible && (
                            <button className="text-gray-400 hover:text-gray-600 p-1">
                                {isCollapsed ? '▼' : '▲'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Content */}
            {(!collapsible || !isCollapsed) && (
                <div className={`
          text-sm text-gray-700 whitespace-pre-wrap leading-relaxed
          ${collapsible ? 'max-h-48 overflow-y-auto' : ''}
        `}>
                    {content}
                </div>
            )}

            {/* Collapsed Preview */}
            {collapsible && isCollapsed && (
                <p className="text-sm text-gray-400 truncate">
                    {content.substring(0, 50)}...
                </p>
            )}
        </div>
    )
}
