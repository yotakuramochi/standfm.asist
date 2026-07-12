'use client'

import { useEffect, useState } from 'react'
import { upload } from '@vercel/blob/client'
import AudioRecorder from '@/components/AudioRecorder'
import AudioUploader from '@/components/AudioUploader'
import ProgressIndicator from '@/components/ProgressIndicator'
import ResultCard from '@/components/ResultCard'

type ProcessingStatus = 'idle' | 'uploading' | 'transcribing' | 'generating' | 'saving' | 'done' | 'error'
type StandfmStatus = 'idle' | 'opening' | 'opened' | 'saving' | 'saved' | 'needs_attention' | 'error'
type AudioInputMode = 'record' | 'upload'

interface GeneratedContent {
    transcript: string
    summary: string
    titles: string[]
    description: string
    xPost: string
    noteArticle: string
    substackLetter: string
    journalSynced?: boolean
    isMock?: boolean
}

interface ProfileSettings {
    achievements: string[]
    targetAudience: string
    channelDescription: string
    xLink: string
    customLinks: { name: string; url: string }[]
}

interface StandfmState {
    status: StandfmStatus
    message: string
    url?: string
    warnings?: string[]
}

const TONE_PRESETS = [
    { id: 'standard', label: '標準', detail: '自然で聞きやすい文章' },
    { id: 'casual', label: 'カジュアル', detail: '親しみやすく軽め' },
    { id: 'formal', label: '丁寧', detail: '落ち着いた敬語' },
    { id: 'short', label: '短め', detail: '要点を絞る' },
]

const HISTORY_KEY = 'standfm-ai-history'
const PROFILE_KEY = 'standfm-ai-profile'
const DIRECT_UPLOAD_LIMIT = 4 * 1024 * 1024 // これ以下は直接POST、超えたらBlob経由
const MAX_AUDIO_SIZE = 24 * 1024 * 1024 // Whisper APIの上限(25MB)に合わせる
const STANDFM_URL = 'https://stand.fm/'

function buildDescriptionWithTemplate(aiDescription: string, profile: ProfileSettings | null): string {
    if (!profile) return aiDescription

    const parts: string[] = []

    if (profile.channelDescription) {
        parts.push('▼このチャンネルでは')
        parts.push(profile.channelDescription)
        parts.push('')
    }

    if (profile.xLink) {
        parts.push('X（旧Twitter）')
        parts.push(profile.xLink)
        parts.push('')
    }

    profile.customLinks
        .filter((link) => link.name && link.url)
        .forEach((link) => {
            parts.push(link.name)
            parts.push(link.url)
            parts.push('')
        })

    if (parts.length > 0) {
        parts.push('【AI要約】')
    }

    parts.push(aiDescription)

    return parts.join('\n')
}

function cleanTitle(title: string) {
    const trimmed = title.trim()
    return trimmed.replace(/^[^A-Za-z0-9ぁ-んァ-ヶ一-龠０-９Ａ-Ｚａ-ｚ]+/, '').trim() || trimmed
}

export default function Home() {
    const [status, setStatus] = useState<ProcessingStatus>('idle')
    const [progress, setProgress] = useState(0)
    const [tonePreset, setTonePreset] = useState('standard')
    const [inputMode, setInputMode] = useState<AudioInputMode>('record')
    const [autoSaveToStandfm, setAutoSaveToStandfm] = useState(true)
    const [content, setContent] = useState<GeneratedContent | null>(null)
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [postPackageCopied, setPostPackageCopied] = useState(false)
    const [profile, setProfile] = useState<ProfileSettings | null>(null)
    const [standfm, setStandfm] = useState<StandfmState>({
        status: 'idle',
        message: 'stand.fm にログインしておくと、生成後に下書き保存まで進めます。',
    })
    // Chrome自動操作はこのサーバーがMac上(localhost)で動いているときだけ使える。
    // 本番(Vercel)ではPC/スマホ問わず動かないので、ログイン導線を出さない
    const [automationAvailable, setAutomationAvailable] = useState(false)

    useEffect(() => {
        const stored = localStorage.getItem(PROFILE_KEY)

        if (stored) {
            try {
                setProfile(JSON.parse(stored))
            } catch (e) {
                console.error('Failed to parse profile:', e)
            }
        }

        const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname)
        setAutomationAvailable(isLocal)

        if (!isLocal) {
            setStandfm({
                status: 'idle',
                message:
                    'スマホではstand.fmへのログインは不要です。生成後に「タイトル+概要欄をコピー」して、stand.fm公式アプリの投稿画面に貼り付けてください。',
            })
        }
    }, [])

    const saveToHistory = (data: GeneratedContent) => {
        try {
            const stored = localStorage.getItem(HISTORY_KEY)
            const history = stored ? JSON.parse(stored) : []

            const newItem = {
                id: crypto.randomUUID(),
                createdAt: new Date().toISOString().split('T')[0],
                title: cleanTitle(data.titles[0] || '無題'),
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

    const openStandfmLogin = async () => {
        setStandfm({
            status: 'opening',
            message: 'stand.fm のログイン画面を開いています...',
        })

        try {
            const response = await fetch('/api/standfm/login', { method: 'POST' })
            const result = await response.json()

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'stand.fm を開けませんでした')
            }

            setStandfm({
                status: result.data.status || 'opened',
                message: result.data.message,
                url: result.data.url,
                warnings: result.data.warnings,
            })
        } catch (err) {
            setStandfm({
                status: 'error',
                message: err instanceof Error ? err.message : 'stand.fm を開けませんでした',
            })
        }
    }

    const saveGeneratedToStandfm = async (data: GeneratedContent, file: File) => {
        setStandfm({
            status: 'saving',
            message: 'stand.fm の下書きを作成しています...',
        })

        const formData = new FormData()
        formData.append('audio', file)
        formData.append('title', cleanTitle(data.titles[0] || data.summary.slice(0, 40) || 'stand.fm放送'))
        formData.append('description', data.description)

        try {
            const response = await fetch('/api/standfm/save', {
                method: 'POST',
                body: formData,
            })
            const result = await response.json()

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'stand.fm への保存に失敗しました')
            }

            setStandfm({
                status: result.data.status,
                message: result.data.message,
                url: result.data.url,
                warnings: result.data.warnings,
            })
        } catch (err) {
            setStandfm({
                status: 'error',
                message: err instanceof Error ? err.message : 'stand.fm への保存に失敗しました',
            })
        }
    }

    const validateFile = (file: File) => {
        const allowedExtensions = ['.mp3', '.m4a', '.wav', '.webm', '.caf', '.aac', '.ogg']
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
        const hasValidExtension = allowedExtensions.includes(fileExtension)
        const hasValidMimeType = file.type.startsWith('audio/')

        if (file.size > MAX_AUDIO_SIZE) {
            return 'ファイルサイズは24MB以下にしてください(15分前後の収録なら通常収まります)。'
        }

        if (!hasValidExtension && !hasValidMimeType) {
            return '対応形式: mp3, m4a, wav, webm, caf, aac, ogg'
        }

        return null
    }

    const handleFileSelect = async (file: File) => {
        const validationError = validateFile(file)

        if (validationError) {
            setError(validationError)
            return
        }

        setAudioFile(file)
        setContent(null)
        setError(null)
        setStandfm(
            automationAvailable
                ? {
                    status: autoSaveToStandfm ? 'idle' : standfm.status,
                    message: autoSaveToStandfm
                        ? '生成後に stand.fm へ下書き保存します。'
                        : '生成だけ行います。必要ならあとで下書き保存できます。',
                }
                : {
                    status: 'idle',
                    message: '生成後に「タイトル＋概要欄をコピー」して、stand.fm公式アプリに貼り付けてください。',
                }
        )
        setStatus('uploading')
        setProgress(10)

        try {
            let response: Response

            if (file.size > DIRECT_UPLOAD_LIMIT) {
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

            setStatus('generating')
            setProgress(75)

            if (!response.ok) {
                const contentType = response.headers.get('content-type')

                if (contentType && contentType.includes('application/json')) {
                    const errorData = await response.json()
                    throw new Error(errorData.error || '処理に失敗しました')
                }

                const errorText = await response.text()
                throw new Error(errorText.substring(0, 120) || '処理に失敗しました')
            }

            const result = await response.json()

            if (!result.success) {
                throw new Error(result.error || '処理に失敗しました')
            }

            const processedData: GeneratedContent = {
                ...result.data,
                description: buildDescriptionWithTemplate(result.data.description, profile),
                isMock: Boolean(result.mock),
            }

            setContent(processedData)

            if (!processedData.isMock) {
                saveToHistory(processedData)
            }

            if (processedData.isMock) {
                setStandfm({
                    status: 'needs_attention',
                    message: 'APIキーが未設定のためサンプル生成です。実際の投稿には使わず、OpenAIとGeminiのキーを設定してください。',
                })
                setProgress(100)
                setStatus('done')
                return
            }

            if (autoSaveToStandfm && automationAvailable) {
                setStatus('saving')
                setProgress(90)
                await saveGeneratedToStandfm(processedData, file)
            } else if (!automationAvailable) {
                // 本番環境では自動保存できない。音声をサーバーへ送り直して失敗するより先に案内を出す
                setStandfm({
                    status: 'needs_attention',
                    message: '生成できました。「タイトル＋概要欄をコピー」を押して、stand.fm公式アプリの投稿画面に貼り付けてください。',
                })
            }

            setProgress(100)
            setStatus('done')
        } catch (err) {
            setError(err instanceof Error ? err.message : '処理中にエラーが発生しました')
            setStatus('error')
        }
    }

    const handleManualSave = async () => {
        if (!content || !audioFile) {
            setStandfm({
                status: 'error',
                message: '保存する音声と生成結果がありません。先に音声を処理してください。',
            })
            return
        }

        setStatus('saving')
        await saveGeneratedToStandfm(content, audioFile)
        setStatus('done')
    }

    const copyPostPackage = async () => {
        if (!content) return

        const text = [
            '【タイトル】',
            cleanTitle(content.titles[0] || ''),
            '',
            '【概要欄】',
            content.description,
        ].join('\n')

        try {
            await navigator.clipboard.writeText(text)
            setPostPackageCopied(true)
            if (navigator.vibrate) navigator.vibrate(50)
            setTimeout(() => setPostPackageCopied(false), 2000)
        } catch {
            setError('コピーできませんでした。タイトルと概要欄のコピー機能を使ってください。')
        }
    }

    const handleReset = () => {
        setStatus('idle')
        setProgress(0)
        setContent(null)
        setAudioFile(null)
        setError(null)
        setPostPackageCopied(false)
        setStandfm({
            status: 'idle',
            message: 'stand.fm にログインしておくと、生成後に下書き保存まで進めます。',
        })
    }

    return (
        <div className="pb-20">
            <div className="mb-8">
                <p className="text-sm font-medium text-teal-700 mb-2">音声から下書き保存まで</p>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-950 mb-3">
                    stand.fm の投稿準備を自動化
                </h1>
                <p className="text-gray-500 text-base sm:text-lg">
                    音声を渡すだけで、タイトル・概要欄を作って stand.fm の下書き保存まで進めます。
                </p>
            </div>

            <section className="mb-6 grid gap-3 sm:grid-cols-3">
                {[
                    ['1', '音声を渡す'],
                    ['2', 'AIが作る'],
                    ['3', '下書き保存'],
                ].map(([number, label]) => (
                    <div key={number} className="rounded-lg border border-gray-200 bg-white p-4">
                        <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white">
                                {number}
                            </span>
                            <span className="font-medium text-gray-800">{label}</span>
                        </div>
                    </div>
                ))}
            </section>

            <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="font-bold text-gray-900">stand.fm 連携</h2>
                        <p className="mt-1 text-sm text-gray-500">{standfm.message}</p>
                        {standfm.warnings && standfm.warnings.length > 0 && (
                            <ul className="mt-2 space-y-1 text-sm text-amber-700">
                                {standfm.warnings.map((warning) => (
                                    <li key={warning}>{warning}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                        {standfm.url && (
                            <a
                                href={standfm.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800"
                            >
                                stand.fmを開く
                            </a>
                        )}
                        {automationAvailable && (
                            <button
                                onClick={openStandfmLogin}
                                disabled={standfm.status === 'opening' || status === 'saving'}
                                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                                {standfm.status === 'opening' ? '起動中...' : 'ログインを開く'}
                            </button>
                        )}
                        {content && audioFile && automationAvailable && (
                            <button
                                onClick={handleManualSave}
                                disabled={status === 'saving' || standfm.status === 'saving'}
                                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50"
                            >
                                {standfm.status === 'saving' ? '保存中...' : '下書き保存'}
                            </button>
                        )}
                    </div>
                </div>
            </section>

            {error && (
                <div className="alert-error rounded-lg p-4 mb-6">
                    {error}
                </div>
            )}

            {status === 'idle' && (
                <>
                    {!profile?.channelDescription && (
                        <div className="alert-info rounded-lg p-4 mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <span>設定画面でチャンネル情報を入れると、概要欄に定型文を足せます。</span>
                            <a href="/settings" className="font-medium text-blue-700 hover:underline">設定へ</a>
                        </div>
                    )}

                    <section className="mb-8">
                        <label className="block text-base text-gray-700 font-medium mb-4">生成スタイル</label>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {TONE_PRESETS.map((preset) => (
                                <button
                                    key={preset.id}
                                    onClick={() => setTonePreset(preset.id)}
                                    className={`
                                        rounded-lg border p-4 text-left transition-colors
                                        ${tonePreset === preset.id
                                            ? 'border-teal-600 bg-teal-50'
                                            : 'border-gray-200 bg-white hover:bg-gray-50'
                                        }
                                    `}
                                >
                                    <div className="font-bold text-gray-900">{preset.label}</div>
                                    <div className="mt-1 text-xs text-gray-500">{preset.detail}</div>
                                </button>
                            ))}
                        </div>
                    </section>

                    {automationAvailable && (
                        <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
                            <label className="flex items-center justify-between gap-4">
                                <span>
                                    <span className="block font-bold text-gray-900">生成後に投稿準備まで進める</span>
                                    <span className="mt-1 block text-sm text-gray-500">
                                        可能なら下書き保存、難しい環境ではコピーとstand.fm起動まで進めます。
                                    </span>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={autoSaveToStandfm}
                                    onChange={(event) => setAutoSaveToStandfm(event.target.checked)}
                                    className="h-5 w-5 accent-teal-600"
                                />
                            </label>
                        </section>
                    )}

                    <section className="mb-4">
                        <div className="grid grid-cols-2 rounded-lg border border-gray-200 bg-white p-1">
                            <button
                                onClick={() => setInputMode('record')}
                                className={`
                                    h-11 rounded-md text-sm font-bold transition-colors
                                    ${inputMode === 'record'
                                        ? 'bg-gray-900 text-white'
                                        : 'text-gray-600 hover:bg-gray-50'
                                    }
                                `}
                            >
                                録音
                            </button>
                            <button
                                onClick={() => setInputMode('upload')}
                                className={`
                                    h-11 rounded-md text-sm font-bold transition-colors
                                    ${inputMode === 'upload'
                                        ? 'bg-gray-900 text-white'
                                        : 'text-gray-600 hover:bg-gray-50'
                                    }
                                `}
                            >
                                ファイル
                            </button>
                        </div>
                    </section>

                    {inputMode === 'record' ? (
                        <AudioRecorder onFileReady={handleFileSelect} />
                    ) : (
                        <AudioUploader onFileSelect={handleFileSelect} />
                    )}
                </>
            )}

            {(status === 'uploading' || status === 'transcribing' || status === 'generating' || status === 'saving') && (
                <ProgressIndicator status={status} progress={progress} />
            )}

            {status === 'done' && content && (
                <div className="space-y-4">
                    {content.isMock && (
                        <div className="alert-warning rounded-lg p-4 text-center">
                            これはサンプル生成です。APIキー設定後にもう一度音声を処理してください。
                        </div>
                    )}

                    {!content.isMock && (
                        <div className={content.journalSynced ? 'alert-success rounded-lg p-4 text-center' : 'alert-warning rounded-lg p-4 text-center'}>
                            {content.journalSynced
                                ? '📓 Obsidian日誌へ記録済み(Discord経由)。日誌への反映はMacのlistener起動時に行われます。'
                                : '📓 日誌への自動記録はスキップされました(Discord未設定または送信失敗)。'}
                        </div>
                    )}

                    <div className={
                        standfm.status === 'saved'
                            ? 'alert-success rounded-lg p-4 text-center'
                            : standfm.status === 'needs_attention'
                                ? 'alert-warning rounded-lg p-4 text-center'
                                : standfm.status === 'error'
                                    ? 'alert-error rounded-lg p-4 text-center'
                                    : 'alert-info rounded-lg p-4 text-center'
                    }>
                        {standfm.message}
                        {standfm.url && (
                            <div className="mt-3">
                                <a
                                    href={standfm.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800"
                                >
                                    stand.fmを開く
                                </a>
                            </div>
                        )}
                    </div>

                    <section className="grid gap-3 sm:grid-cols-2">
                        <button
                            onClick={copyPostPackage}
                            className="h-14 rounded-lg bg-gray-900 px-5 text-base font-bold text-white hover:bg-gray-800"
                        >
                            {postPackageCopied ? 'コピーしました' : 'タイトル＋概要欄をコピー'}
                        </button>
                        <a
                            href={standfm.url || STANDFM_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="flex h-14 items-center justify-center rounded-lg bg-teal-600 px-5 text-base font-bold text-white hover:bg-teal-700"
                        >
                            stand.fmを開く
                        </a>
                    </section>

                    <ResultCard
                        title="保存に使うタイトル"
                        content={cleanTitle(content.titles[0] || '')}
                        icon="T"
                        highlight
                    />

                    <ResultCard
                        title="stand.fm 概要欄"
                        content={content.description}
                        icon="S"
                    />

                    <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
                        <div className="text-sm font-medium text-gray-600">タイトル候補</div>
                        {content.titles.map((title) => (
                            <ResultCard
                                key={title}
                                content={cleanTitle(title)}
                                compact
                            />
                        ))}
                    </div>

                    <ResultCard
                        title="要約"
                        content={content.summary}
                        icon="M"
                        collapsible
                    />

                    <ResultCard
                        title="X投稿文"
                        content={content.xPost}
                        icon="X"
                        collapsible
                    />

                    <ResultCard
                        title="Note記事(下書き)"
                        content={content.noteArticle || ''}
                        icon="N"
                        collapsible
                        defaultCollapsed
                    />

                    <ResultCard
                        title="Substackレター(下書き)"
                        content={content.substackLetter || ''}
                        icon="✉"
                        collapsible
                        defaultCollapsed
                    />

                    <ResultCard
                        title="文字起こし"
                        content={content.transcript}
                        icon="A"
                        collapsible
                        defaultCollapsed
                    />

                    <button
                        onClick={handleReset}
                        className="w-full rounded-lg border-2 border-gray-200 py-4 font-medium text-gray-600 hover:bg-gray-50"
                    >
                        新しい音声を処理
                    </button>
                </div>
            )}
        </div>
    )
}
