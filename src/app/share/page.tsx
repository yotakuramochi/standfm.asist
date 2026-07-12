'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { upload } from '@vercel/blob/client'
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
    noteArticle: string
    substackLetter: string
    journalSynced?: boolean
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

// sw.jsが共有音声を保管するCache Storageの場所(public/sw.jsと揃えること)
const SHARED_AUDIO_CACHE = 'shared-audio'
const SHARED_AUDIO_KEY = '/__shared-audio'

function loadProfileFromStorage(): ProfileSettings | null {
    try {
        const stored = localStorage.getItem(PROFILE_KEY)
        return stored ? JSON.parse(stored) : null
    } catch {
        return null
    }
}

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
    const sharedHandledRef = useRef(false)

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

        const errorParam = searchParams.get('error')
        if (errorParam === 'too-large') {
            setError('共有経由で受け取れるのは4MBまででした。下のボタンからファイルを選び直してください(24MBまでOK)。')
        } else if (errorParam) {
            setError('共有された音声を受け取れませんでした。下のボタンからファイルを選び直してください。')
        }

        // 共有音声の処理は一度だけ(StrictModeの二重実行・再レンダー対策)
        if (sharedHandledRef.current) return

        // SW経由: 端末内(Cache Storage)に保管された音声を取り出す
        if (searchParams.get('sharedAudio') === '1') {
            sharedHandledRef.current = true
            loadSharedAudioFromCache()
            return
        }

        // フォールバック経由: /api/shareがVercel Blobに保存した音声URLを処理する
        const blobUrl = searchParams.get('blobUrl')
        if (blobUrl) {
            sharedHandledRef.current = true
            processBlobUrl(blobUrl, searchParams.get('fileName') || 'shared-audio.m4a')
        }
    }, [searchParams])

    const loadSharedAudioFromCache = async () => {
        try {
            const cache = await caches.open(SHARED_AUDIO_CACHE)
            const cached = await cache.match(SHARED_AUDIO_KEY)

            if (!cached) {
                setError('共有された音声が見つかりませんでした。下のボタンからファイルを選び直してください。')
                return
            }

            const blob = await cached.blob()
            const name =
                decodeURIComponent(cached.headers.get('X-Shared-File-Name') || '') || 'shared-audio.m4a'
            await cache.delete(SHARED_AUDIO_KEY)

            setSharedFile(new File([blob], name, { type: blob.type }))
        } catch (e) {
            console.error('Failed to load shared audio:', e)
            setError('共有された音声を読み込めませんでした。下のボタンからファイルを選び直してください。')
        }
    }

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
                noteArticle: data.noteArticle,
                substackLetter: data.substackLetter,
            }

            localStorage.setItem(HISTORY_KEY, JSON.stringify([newItem, ...history]))
        } catch (e) {
            console.error('Failed to save to history:', e)
        }
    }

    const handleFileSelect = async (file: File) => {
        const directUploadLimit = 4 * 1024 * 1024 // 4MB超はVercel Blob経由
        const maxSize = 24 * 1024 * 1024 // Whisper APIの上限(25MB)に合わせる
        const allowedExtensions = ['.mp3', '.m4a', '.wav', '.webm', '.caf', '.aac', '.ogg']
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()

        if (file.size > maxSize) {
            setError('ファイルサイズは24MB以下にしてください(15分前後の収録なら通常収まります)')
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
            let response: Response

            if (file.size > directUploadLimit) {
                // 4MB超はVercel Blobへ直接アップロードしてからURLを渡す
                setProgress(20)
                const blob = await upload(file.name, file, {
                    access: 'public',
                    handleUploadUrl: '/api/upload',
                })

                setStatus('transcribing')
                setProgress(35)

                response = await fetch('/api/process', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        blobUrl: blob.url,
                        fileName: file.name,
                        tone: tonePreset,
                    }),
                })
            } else {
                const formData = new FormData()
                formData.append('audio', file)
                formData.append('tone', tonePreset)

                setStatus('transcribing')
                setProgress(35)

                response = await fetch('/api/process', {
                    method: 'POST',
                    body: formData,
                })
            }

            await handleProcessResponse(response)
        } catch (err) {
            setError(err instanceof Error ? err.message : '処理中にエラーが発生しました')
            setStatus('error')
        }
    }

    const handleProcessResponse = async (response: Response) => {
        setProgress(50)
        setStatus('generating')

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || '処理に失敗しました')
        }

        setProgress(100)
        const result = await response.json()

        if (result.success) {
            // マウント直後に呼ばれるとprofile stateが未設定のことがあるためstorageも見る
            const fullDescription = buildDescriptionWithTemplate(
                result.data.description,
                profile ?? loadProfileFromStorage()
            )
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
    }

    const processBlobUrl = async (blobUrl: string, fileName: string) => {
        setError(null)
        setStatus('transcribing')
        setProgress(35)

        try {
            const response = await fetch('/api/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ blobUrl, fileName, tone: tonePreset }),
            })

            await handleProcessResponse(response)
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
                        title="Note記事(下書き)"
                        content={content.noteArticle || ''}
                        icon="📰"
                        collapsible
                        defaultCollapsed
                    />

                    <ResultCard
                        title="Substackレター(下書き)"
                        content={content.substackLetter || ''}
                        icon="✉️"
                        collapsible
                        defaultCollapsed
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
