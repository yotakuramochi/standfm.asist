'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface HistoryItem {
    id: string
    createdAt: string
    title: string
    duration: string
    summary: string
    xPost: string
    description: string
}

// Local storage key for history
const HISTORY_KEY = 'standfm-ai-history'

export function useHistory() {
    const [history, setHistory] = useState<HistoryItem[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Load history from localStorage on mount
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

    // Save history to localStorage whenever it changes
    useEffect(() => {
        if (!isLoading) {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
        }
    }, [history, isLoading])

    const addToHistory = (item: Omit<HistoryItem, 'id' | 'createdAt'>) => {
        const newItem: HistoryItem = {
            ...item,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString().split('T')[0],
        }
        setHistory((prev) => [newItem, ...prev])
        return newItem
    }

    const removeFromHistory = (id: string) => {
        setHistory((prev) => prev.filter((item) => item.id !== id))
    }

    const clearHistory = () => {
        setHistory([])
    }

    return {
        history,
        isLoading,
        addToHistory,
        removeFromHistory,
        clearHistory,
    }
}
