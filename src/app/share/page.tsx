'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import AudioUploader from '@/components/AudioUploader'
import ProgressIndicator from '@/components/ProgressIndicator'
import ResultCard from '@/components/ResultCard'

type ProcessingStatus = 'idle' | 'uploading' | 'transcribing' | 'generating' | 'done' | 'error'

interface GeneratedContent {
    transcript: string
    summary: string
    titles: string[]
    description: string
    xPost: string
}

interface ProfileSettings {
    achievements: string[]
    targetAudience: string
    channelDescription: string
    xLink: string
    customLinks: { name: string; url: string }[]
}

const TONE_PRESETS = [
    { id: 'standard', label: '標準', emoji: '✨' },
    { id: 'casual', label: 'カジュアル', emoji: '😊' },
    { id: 'formal', label: '丁寧', emoji: '🎩' },
    { id: 'short', label: '短め', emoji: '⚡' },
]

const HISTORY_KEY = 'standfm-ai-history'
const PROFILE_KEY = 'standfm-ai-profile'

function buildDescriptionWithTemplate(aiDescription: string, profile: ProfileSettings | null): string {
    if (!profile) return aiDescription

    const parts: string[] = []

    if (profile.channelDescription) {
        parts.push(`▼このチャンネルでは`)
        parts.push(profile.channelDescription)
        parts.push('')
    }

    if (profile.xLink) {
        parts.push(`▪️X（旧Twitter）`)
        parts.push(profile.xLink)
        parts.push('')
    }

    profile.customLinks
        .filter(link => link.name && link.url)
        .forEach(link => {
            parts.push(`▪️${link.name}`)
            parts.push(link.url)
            parts.push('')
        })

    if (parts.length > 0) {
        parts.push('【AI要約】')
    }
    parts.push(aiDescription)

    return parts.join('\n')
}

function SharePageContent() {
    const searchParams = useSearchParams()
    const [status, setStatus] = useState<ProcessingStatus>('idle')
    const [progress, setProgress] = useState(0)
    const [tonePreset, setTonePreset] = useState('standard')
    const [content, setContent] = useState<GeneratedContent | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [profile, setProfile] = useState<ProfileSettings | null>(null)
    const [sharedFile, setSharedFile] = useState<File | null>(null)
    const [sharedText, setSharedText] = useState<string>('')

    useEffect(() => {
        const stored = localStorage.getItem(PROFILE_KEY)
        if (stored) {
            try {
                setProfile(JSON.parse(stored))
            } catch (e) {
                console.error('Failed to parse profile:', e)
            }
        }

        // Check for shared text/url from query params
        const title = searchParams.get('title')
        const text = searchParams.get('text')
        const url = searchParams.get('url')

        if (title || text || url) {
            setSharedText([title, text, url].filter(Boolean).join('\n'))
        }
    }, [searchParams])

    const saveToHistory = (data: GeneratedContent) => {
        try {
            const stored = localStorage.getItem(HISTORY_KEY)
            const history = stored ? JSON.parse(stored) : []

            const newItem = {
                id: crypto.randomUUID(),
                createdAt: new Date().toISOString().split('T')[0],
                title: data.titles[0]?.replace(/^[^\s]+\s*/, '') || '無題',
                duration: '',
                summary: data.summary,
                xPost: data.xPost,
                description: data.description,
                transcript: data.transcript,
            }

            localStorage.setItem(HISTORY_KEY, JSON.stringify([newItem, ...history]))
        } catch (e) {
            console.error('Failed to save to history:', e)
        }
    }

    const handleFileSelect = async (file: File) => {
        const maxSize = 30 * 1024 * 1024
        const allowedExtensions = ['.mp3', '.m4a', '.wav', '.webm', '.caf', '.aac', '.ogg']
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()

        if (file.size > maxSize) {
            setError('ファイルサイズは30MB以下にしてください')
            return
        }

        const hasValidExtension = allowedExtensions.includes(fileExtension)
        const hasValidMimeType = file.type.startsWith('audio/')

        if (!hasValidExtension && !hasValidMimeType) {
            setError('対応形式: mp3, m4a, wav, webm, caf, aac, ogg')
            return
        }

        setError(null)
        setStatus('uploading')
        setProgress(0)

        try {
            const formData = new FormData()
            formData.append('audio', file)
            formData.append('tone', tonePreset)

            const uploadInterval = setInterval(() => {
                setProgress((prev: number) => Math.min(prev + 10, 90))
            }, 200)

            setStatus('transcribing')
            setProgress(0)
            clearInterval(uploadInterval)

            const response = await fetch('/api/process', {
                method: 'POST',
                body: formData,
            })

            setProgress(50)
            setStatus('generating')

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || '処理に失敗しました')
            }

            setProgress(100)
            const result = await response.json()

            if (result.success) {
                const fullDescription = buildDescriptionWithTemplate(result.data.description, profile)
                const processedData = {
                    ...result.data,
                    description: fullDescription,
                }

                setContent(processedData)
                saveToHistory(processedData)
                setStatus('done')
            } else {
                throw new Error(result.error || '処理に失敗しました')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '処理中にエラーが発生しました')
            setStatus('error')
        }
    }

    const handleReset = () => {
        setStatus('idle')
        setProgress(0)
        setContent(null)
        setError(null)
        setSharedFile(null)
    }

    // Auto-process if file was shared
    useEffect(() => {
        if (sharedFile && status === 'idle') {
            handleFileSelect(sharedFile)
        }
    }, [sharedFile])

    return (
        <div className="pb-20">
            {/* Header */}
            <div className="text-center mb-8">
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
                    📤 共有で受け取りました
                </h1>
                <p className="text-gray-500 text-base sm:text-lg">
                    音声ファイルを処理します
                </p>
            </div>

            {/* Shared Text Display */}
            {sharedText && (
                <div className="alert-info rounded-lg p-4 mb-6">
                    <p className="font-medium">共有されたテキスト:</p>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{sharedText}</p>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="alert-error rounded-lg p-4 mb-6">
                    ⚠️ {error}
                </div>
            )}

            {/* Status: Idle - Show uploader */}
            {status === 'idle' && (
                <>
                    <div className="alert-warning rounded-lg p-4 mb-6">
                        💡 音声ファイルが共有されていない場合は、下のボタンから選択してください
                    </div>

                    {/* Tone Preset Selection */}
                    <div className="mb-8">
                        <label className="block text-base text-gray-700 font-medium mb-4">生成スタイル</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                            {TONE_PRESETS.map((preset) => (
                                <button
                                    key={preset.id}
                                    onClick={() => setTonePreset(preset.id)}
                                    className={`
                    p-4 sm:p-5 rounded-xl text-center transition-all
                    ${tonePreset === preset.id
                                            ? 'bg-orange-50 border-2 border-orange-500'
                                            : 'bg-gray-50 border-2 border-transparent hover:border-gray-200'
                                        }
                  `}
                                >
                                    <div className="text-2xl sm:text-3xl">{preset.emoji}</div>
                                    <div className="text-sm sm:text-base mt-2 text-gray-700">{preset.label}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Audio Uploader */}
                    <AudioUploader onFileSelect={handleFileSelect} />

                    {/* Back to Home */}
                    <div className="text-center mt-6">
                        <a href="/" className="text-gray-500 hover:text-gray-700">
                            ← ホームへ戻る
                        </a>
                    </div>
                </>
            )}

            {/* Status: Processing */}
            {(status === 'uploading' || status === 'transcribing' || status === 'generating') && (
                <ProgressIndicator status={status} progress={progress} />
            )}

            {/* Status: Done - Show results */}
            {status === 'done' && content && (
                <div className="space-y-4">
                    <div className="alert-success rounded-lg p-4 text-center">
                        ✅ 生成完了！履歴に保存しました
                    </div>

                    <ResultCard
                        title="X投稿文"
                        content={content.xPost}
                        icon="🐦"
                        highlight
                    />

                    <ResultCard
                        title="stand.fm 概要欄"
                        content={content.description}
                        icon="🎙️"
                    />

                    <div className="card p-5 space-y-3">
                        <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                            <span>📝</span>
                            <span>タイトル候補</span>
                        </div>
                        {content.titles.map((title, i) => (
                            <ResultCard
                                key={i}
                                content={title}
                                compact
                            />
                        ))}
                    </div>

                    <ResultCard
                        title="要約"
                        content={content.summary}
                        icon="📋"
                        collapsible
                    />

                    <ResultCard
                        title="文字起こし"
                        content={content.transcript}
                        icon="📜"
                        collapsible
                        defaultCollapsed
                    />

                    <button
                        onClick={handleReset}
                        className="w-full py-4 rounded-xl border-2 border-gray-200 text-gray-600 hover:bg-gray-50 font-medium"
                    >
                        新しい音声を処理
                    </button>
                </div>
            )}
        </div>
    )
}

export default function SharePage() {
    return (
        <Suspense fallback={<div className="text-center py-20">読み込み中...</div>}>
            <SharePageContent />
        </Suspense>
    )
}
