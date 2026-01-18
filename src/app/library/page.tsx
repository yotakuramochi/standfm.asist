'use client'

import { useState, useEffect } from 'react'
import ResultCard from '@/components/ResultCard'

interface HistoryItem {
    id: string
    createdAt: string
    title: string
    duration: string
    summary: string
    xPost: string
    description: string
    transcript?: string
}

const HISTORY_KEY = 'standfm-ai-history'

export default function LibraryPage() {
    const [searchQuery, setSearchQuery] = useState('')
    const [history, setHistory] = useState<HistoryItem[]>([])
    const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const stored = localStorage.getItem(HISTORY_KEY)
        if (stored) {
            try {
                setHistory(JSON.parse(stored))
            } catch (e) {
                console.error('Failed to parse history:', e)
            }
        }
        setIsLoading(false)
    }, [])

    const filteredHistory = history.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.summary.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleDelete = (id: string) => {
        const newHistory = history.filter(item => item.id !== id)
        setHistory(newHistory)
        localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory))
        setSelectedItem(null)
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin text-4xl">🔄</div>
            </div>
        )
    }

    return (
        <div className="pb-20">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">履歴・ライブラリ</h1>
                <p className="text-gray-500">
                    過去の生成結果を検索・再利用
                </p>
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="キーワードで検索..."
                    className="input-field pl-10"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    🔍
                </span>
            </div>

            {/* Item Detail Modal */}
            {selectedItem && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-xl">
                        {/* Header */}
                        <div className="sticky top-0 bg-white p-4 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="font-bold text-gray-900 truncate pr-4">{selectedItem.title}</h2>
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="text-2xl text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-4">
                            <ResultCard
                                title="X投稿文"
                                content={selectedItem.xPost}
                                icon="🐦"
                                highlight
                            />
                            <ResultCard
                                title="概要欄"
                                content={selectedItem.description}
                                icon="🎙️"
                            />
                            <ResultCard
                                title="要約"
                                content={selectedItem.summary}
                                icon="📋"
                            />
                            {selectedItem.transcript && (
                                <ResultCard
                                    title="文字起こし"
                                    content={selectedItem.transcript}
                                    icon="📜"
                                    collapsible
                                    defaultCollapsed
                                />
                            )}

                            {/* Delete Button */}
                            <button
                                onClick={() => handleDelete(selectedItem.id)}
                                className="w-full py-3 rounded-xl border border-red-200 text-red-500 hover:bg-red-50"
                            >
                                🗑️ この履歴を削除
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* History List */}
            <div className="space-y-3">
                {filteredHistory.length === 0 ? (
                    <div className="card p-8 text-center text-gray-500">
                        <p className="text-4xl mb-4">📭</p>
                        <p>履歴がありません</p>
                        <p className="text-sm mt-2">音声をアップロードして始めましょう</p>
                    </div>
                ) : (
                    filteredHistory.map((item) => (
                        <div
                            key={item.id}
                            onClick={() => setSelectedItem(item)}
                            className="card p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                            <div className="flex items-start gap-3">
                                {/* Icon */}
                                <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center text-2xl shrink-0">
                                    🎙️
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-medium text-gray-900 truncate">{item.title}</h3>
                                    <p className="text-sm text-gray-500 truncate mt-1">
                                        {item.summary}
                                    </p>
                                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                        <span>📅 {item.createdAt}</span>
                                        {item.duration && <span>⏱️ {item.duration}</span>}
                                    </div>
                                </div>

                                {/* Arrow */}
                                <span className="text-gray-300">→</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Stats */}
            {filteredHistory.length > 0 && (
                <div className="text-center text-sm text-gray-400 mt-6">
                    全 {filteredHistory.length} 件
                </div>
            )}
        </div>
    )
}
