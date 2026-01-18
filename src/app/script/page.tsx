'use client'

import { useState, useEffect } from 'react'
import CopyButton from '@/components/CopyButton'

interface SavedPost {
    id: string
    title: string
    summary: string
    xPost: string
    description: string
    transcript?: string
    createdAt: string
}

interface SelectedMaterial {
    postId: string
    title: string
    content: string
    reason: string
}

interface GeneratedScript {
    title: string
    opening: string
    body: { heading: string; points: string[] }[]
    conclusion: string
    estimatedTime: string
    fullText: string
}

const HISTORY_KEY = 'standfm-ai-history'
const SCRIPTS_KEY = 'standfm-ai-scripts'

const TONE_OPTIONS = [
    { id: 'standard', label: '標準', emoji: '✨' },
    { id: 'casual', label: 'カジュアル', emoji: '😊' },
    { id: 'polite', label: '丁寧', emoji: '🎩' },
]

const LENGTH_OPTIONS = [
    { id: 'short', label: '短め（5分）', emoji: '⚡' },
    { id: 'standard', label: '標準（10分）', emoji: '📻' },
    { id: 'long', label: '長め（15分）', emoji: '📚' },
]

export default function ScriptPage() {
    const [memo, setMemo] = useState('')
    const [autoSelectMaterial, setAutoSelectMaterial] = useState(true)
    const [tone, setTone] = useState('standard')
    const [length, setLength] = useState('standard')
    const [isGenerating, setIsGenerating] = useState(false)
    const [savedPosts, setSavedPosts] = useState<SavedPost[]>([])
    const [selectedMaterials, setSelectedMaterials] = useState<SelectedMaterial[]>([])
    const [generatedScript, setGeneratedScript] = useState<GeneratedScript | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [showMaterialWarning, setShowMaterialWarning] = useState(false)
    const [isSaved, setIsSaved] = useState(false)

    // Load saved posts from history
    useEffect(() => {
        const stored = localStorage.getItem(HISTORY_KEY)
        if (stored) {
            try {
                const history = JSON.parse(stored)
                setSavedPosts(history.map((item: SavedPost) => ({
                    ...item,
                    content: item.xPost || item.summary || item.description || ''
                })))
            } catch (e) {
                console.error('Failed to load history:', e)
            }
        }
    }, [])

    // ScriptMaterialSkill - Find relevant materials from saved posts
    const findRelevantMaterials = (memoText: string, posts: SavedPost[]): SelectedMaterial[] => {
        if (!posts.length) return []

        // Extract keywords from memo (simple implementation)
        const keywords = memoText
            .toLowerCase()
            .replace(/[。、！？\n]/g, ' ')
            .split(' ')
            .filter(word => word.length > 1)

        // Score each post
        const scoredPosts = posts.map(post => {
            const content = `${post.title} ${post.summary} ${post.xPost}`.toLowerCase()
            let score = 0

            // Keyword matching
            keywords.forEach(keyword => {
                if (content.includes(keyword)) {
                    score += 2
                }
            })

            // Recency bonus (posts from last 7 days get extra score)
            const postDate = new Date(post.createdAt)
            const daysSince = (Date.now() - postDate.getTime()) / (1000 * 60 * 60 * 24)
            if (daysSince < 7) score += 3
            else if (daysSince < 30) score += 1

            return { post, score }
        })

        // Sort by score and take top 5
        const topPosts = scoredPosts
            .filter(p => p.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)

        // Generate reasons for selection
        return topPosts.map(({ post }) => ({
            postId: post.id,
            title: post.title,
            content: post.xPost || post.summary || '',
            reason: `関連キーワードが一致`,
        }))
    }

    // Generate script using Gemini
    const handleGenerate = async () => {
        if (!memo.trim()) {
            setError('メモを入力してください')
            return
        }

        setError(null)
        setIsGenerating(true)
        setIsSaved(false)
        setShowMaterialWarning(false)

        try {
            // Find relevant materials if enabled
            let materials: SelectedMaterial[] = []
            if (autoSelectMaterial) {
                materials = findRelevantMaterials(memo, savedPosts)
                setSelectedMaterials(materials)
                if (materials.length === 0 && savedPosts.length > 0) {
                    setShowMaterialWarning(true)
                }
            }

            // Call API to generate script
            const response = await fetch('/api/script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memo,
                    materials: materials.map(m => m.content),
                    tone,
                    length,
                }),
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || '生成に失敗しました')
            }

            const result = await response.json()
            setGeneratedScript(result.script)
        } catch (err) {
            setError(err instanceof Error ? err.message : '生成中にエラーが発生しました')
        } finally {
            setIsGenerating(false)
        }
    }

    // Save script to localStorage
    const handleSave = () => {
        if (!generatedScript) return

        try {
            const stored = localStorage.getItem(SCRIPTS_KEY)
            const scripts = stored ? JSON.parse(stored) : []

            const newScript = {
                id: crypto.randomUUID(),
                memoText: memo,
                sourcePostIds: selectedMaterials.map(m => m.postId),
                scriptText: generatedScript.fullText,
                title: generatedScript.title,
                tone,
                length,
                createdAt: new Date().toISOString(),
            }

            localStorage.setItem(SCRIPTS_KEY, JSON.stringify([newScript, ...scripts]))
            setIsSaved(true)
        } catch (e) {
            console.error('Failed to save script:', e)
            setError('保存に失敗しました')
        }
    }

    // Reset for new generation
    const handleReset = () => {
        setGeneratedScript(null)
        setSelectedMaterials([])
        setMemo('')
        setError(null)
        setIsSaved(false)
    }

    return (
        <div className="pb-20">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    📝 台本を作る
                </h1>
                <p className="text-gray-500">
                    気づきやメモから、話す流れを自動生成
                </p>
            </div>

            {/* Error Display */}
            {error && (
                <div className="alert-error rounded-lg p-4 mb-6">
                    ⚠️ {error}
                    <button
                        onClick={() => setError(null)}
                        className="ml-2 text-red-700 hover:underline"
                    >
                        閉じる
                    </button>
                </div>
            )}

            {/* Input Section */}
            {!generatedScript && (
                <div className="space-y-6">
                    {/* Memo Input */}
                    <div>
                        <label className="block text-base text-gray-700 font-medium mb-2">
                            💡 今日の気づき・話したいこと
                        </label>
                        <textarea
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            className="input-field resize-none"
                            rows={6}
                            placeholder="今日の気づき・話したいことを箇条書きでOK&#10;&#10;例：&#10;・最近読んだ本の感想&#10;・仕事で学んだこと&#10;・リスナーに伝えたいこと"
                            maxLength={2000}
                        />
                        <div className="flex justify-between mt-2 text-sm text-gray-400">
                            <span>箇条書き・走り書きでOK</span>
                            <span>{memo.length}/2000</span>
                        </div>
                    </div>

                    {/* Material Selection Toggle */}
                    <div className="card p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-xl">📚</span>
                                <div>
                                    <p className="font-medium text-gray-900">保存済みポストから素材を探す</p>
                                    <p className="text-sm text-gray-500">
                                        {savedPosts.length > 0
                                            ? `${savedPosts.length}件の過去投稿から自動選択`
                                            : '過去投稿がありません'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setAutoSelectMaterial(!autoSelectMaterial)}
                                className={`
                  relative w-14 h-8 rounded-full transition-colors
                  ${autoSelectMaterial ? 'bg-orange-500' : 'bg-gray-300'}
                `}
                            >
                                <span className={`
                  absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform
                  ${autoSelectMaterial ? 'left-7' : 'left-1'}
                `} />
                            </button>
                        </div>
                    </div>

                    {/* Tone Selection */}
                    <div>
                        <label className="block text-base text-gray-700 font-medium mb-3">
                            🎨 トーン
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {TONE_OPTIONS.map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => setTone(option.id)}
                                    className={`
                    p-3 rounded-xl text-center transition-all
                    ${tone === option.id
                                            ? 'bg-orange-50 border-2 border-orange-500'
                                            : 'bg-gray-50 border-2 border-transparent hover:border-gray-200'
                                        }
                  `}
                                >
                                    <div className="text-xl">{option.emoji}</div>
                                    <div className="text-sm mt-1 text-gray-700">{option.label}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Length Selection */}
                    <div>
                        <label className="block text-base text-gray-700 font-medium mb-3">
                            ⏱️ 長さ
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {LENGTH_OPTIONS.map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => setLength(option.id)}
                                    className={`
                    p-3 rounded-xl text-center transition-all
                    ${length === option.id
                                            ? 'bg-orange-50 border-2 border-orange-500'
                                            : 'bg-gray-50 border-2 border-transparent hover:border-gray-200'
                                        }
                  `}
                                >
                                    <div className="text-xl">{option.emoji}</div>
                                    <div className="text-sm mt-1 text-gray-700">{option.label}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Generate Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !memo.trim()}
                        className="w-full py-4 bg-orange-500 text-white font-bold text-lg rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGenerating ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="animate-spin">⏳</span>
                                台本を生成中...
                            </span>
                        ) : (
                            '📝 台本を作る'
                        )}
                    </button>
                </div>
            )}

            {/* Generated Script Display */}
            {generatedScript && (
                <div className="space-y-6">
                    {/* Material Warning */}
                    {showMaterialWarning && (
                        <div className="alert-warning rounded-lg p-4">
                            💡 関連する素材が見つからなかったため、素材なしで台本を作成しました
                        </div>
                    )}

                    {/* Selected Materials */}
                    {selectedMaterials.length > 0 && (
                        <div className="card p-4">
                            <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                                <span>📚</span>
                                使用した素材（{selectedMaterials.length}件）
                            </h3>
                            <div className="space-y-2">
                                {selectedMaterials.map((material) => (
                                    <div key={material.postId} className="bg-gray-50 rounded-lg p-3 text-sm">
                                        <p className="font-medium text-gray-900">{material.title}</p>
                                        <p className="text-gray-500 text-xs mt-1">{material.reason}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Success Message */}
                    <div className="alert-success rounded-lg p-4 flex items-center justify-between">
                        <span>✅ 台本が生成されました！</span>
                        <span className="text-sm">⏱️ {generatedScript.estimatedTime}</span>
                    </div>

                    {/* Script Output */}
                    <div className="card p-6 space-y-6">
                        {/* Header with Copy */}
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900">
                                🎙️ {generatedScript.title}
                            </h2>
                            <CopyButton text={generatedScript.fullText} label="全文コピー" />
                        </div>

                        {/* Opening */}
                        <div>
                            <h3 className="text-sm font-medium text-orange-600 mb-2">🎬 オープニング（つかみ）</h3>
                            <p className="text-gray-700 whitespace-pre-wrap">{generatedScript.opening}</p>
                        </div>

                        {/* Body */}
                        <div>
                            <h3 className="text-sm font-medium text-orange-600 mb-3">📻 本編</h3>
                            <div className="space-y-4">
                                {generatedScript.body.map((section, i) => (
                                    <div key={i} className="bg-gray-50 rounded-lg p-4">
                                        <h4 className="font-medium text-gray-900 mb-2">{section.heading}</h4>
                                        <ul className="space-y-1">
                                            {section.points.map((point, j) => (
                                                <li key={j} className="text-gray-700 text-sm flex items-start gap-2">
                                                    <span className="text-orange-400">•</span>
                                                    <span>{point}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Conclusion */}
                        <div>
                            <h3 className="text-sm font-medium text-orange-600 mb-2">🎯 まとめ</h3>
                            <p className="text-gray-700 whitespace-pre-wrap">{generatedScript.conclusion}</p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleSave}
                            disabled={isSaved}
                            className={`
                flex-1 py-4 rounded-xl font-medium transition-colors
                ${isSaved
                                    ? 'bg-green-100 text-green-700 border border-green-300'
                                    : 'bg-orange-500 text-white hover:bg-orange-600'
                                }
              `}
                        >
                            {isSaved ? '✓ 保存済み' : '💾 保存する'}
                        </button>
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="flex-1 py-4 border-2 border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50"
                        >
                            🔄 再生成
                        </button>
                    </div>

                    {/* New Script Button */}
                    <button
                        onClick={handleReset}
                        className="w-full py-3 text-gray-500 hover:text-gray-700"
                    >
                        新しい台本を作る →
                    </button>
                </div>
            )}
        </div>
    )
}
