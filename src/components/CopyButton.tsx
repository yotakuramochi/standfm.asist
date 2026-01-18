'use client'

import { useState } from 'react'

interface CopyButtonProps {
    text: string
    label?: string
}

export default function CopyButton({ text, label }: CopyButtonProps) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation()

        try {
            await navigator.clipboard.writeText(text)
            setCopied(true)

            if (navigator.vibrate) {
                navigator.vibrate(50)
            }

            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy:', err)
        }
    }

    return (
        <button
            onClick={handleCopy}
            className={`
        flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium
        transition-all
        ${copied
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800'
                }
      `}
        >
            {copied ? (
                <>
                    <span>✓</span>
                    <span>コピー済み</span>
                </>
            ) : (
                <>
                    <span>📋</span>
                    {label && <span>{label}</span>}
                </>
            )}
        </button>
    )
}
