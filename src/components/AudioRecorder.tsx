'use client'

import { useEffect, useRef, useState } from 'react'

interface AudioRecorderProps {
    onFileReady: (file: File) => void
}

type RecorderState = 'idle' | 'recording' | 'ready' | 'error'

function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return `${minutes}:${String(rest).padStart(2, '0')}`
}

function pickMimeType() {
    const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/mpeg',
    ]

    return candidates.find((type) => {
        if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
            return false
        }

        return MediaRecorder.isTypeSupported(type)
    }) || ''
}

function extensionForMimeType(mimeType: string) {
    if (mimeType.includes('mp4')) return 'm4a'
    if (mimeType.includes('mpeg')) return 'mp3'
    return 'webm'
}

export default function AudioRecorder({ onFileReady }: AudioRecorderProps) {
    const [state, setState] = useState<RecorderState>('idle')
    const [seconds, setSeconds] = useState(0)
    const [error, setError] = useState<string | null>(null)
    const [audioUrl, setAudioUrl] = useState<string | null>(null)
    const [recordedFile, setRecordedFile] = useState<File | null>(null)

    const recorderRef = useRef<MediaRecorder | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const chunksRef = useRef<BlobPart[]>([])
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
            streamRef.current?.getTracks().forEach((track) => track.stop())
            if (audioUrl) URL.revokeObjectURL(audioUrl)
        }
    }, [audioUrl])

    const startRecording = async () => {
        setError(null)
        setRecordedFile(null)

        if (audioUrl) {
            URL.revokeObjectURL(audioUrl)
            setAudioUrl(null)
        }

        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
            setError('このブラウザでは録音を使えません。音声ファイルを選択してください。')
            setState('error')
            return
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            })
            const mimeType = pickMimeType()
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

            chunksRef.current = []
            streamRef.current = stream
            recorderRef.current = recorder

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) chunksRef.current.push(event.data)
            }

            recorder.onstop = () => {
                // MediaRecorderは音声のみでも "video/webm" 等のコンテナ型を名乗ることがあるので audio/ に正規化
                const rawType = recorder.mimeType || mimeType || 'audio/webm'
                const type = rawType.replace(/^video\//, 'audio/')
                const blob = new Blob(chunksRef.current, { type })
                const ext = extensionForMimeType(type)
                const file = new File([blob], `standfm-recording-${Date.now()}.${ext}`, { type })
                const nextUrl = URL.createObjectURL(blob)

                stream.getTracks().forEach((track) => track.stop())
                streamRef.current = null
                recorderRef.current = null
                chunksRef.current = []

                setAudioUrl(nextUrl)
                setRecordedFile(file)
                setState('ready')
            }

            recorder.start()
            setSeconds(0)
            setState('recording')
            timerRef.current = setInterval(() => {
                setSeconds((value) => value + 1)
            }, 1000)
        } catch {
            setError('マイクを使えませんでした。ブラウザのマイク許可を確認してください。')
            setState('error')
        }
    }

    const stopRecording = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }

        recorderRef.current?.stop()
    }

    const resetRecording = () => {
        if (audioUrl) URL.revokeObjectURL(audioUrl)
        setAudioUrl(null)
        setRecordedFile(null)
        setSeconds(0)
        setError(null)
        setState('idle')
    }

    return (
        <section className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-gray-900">録音</h2>
                    <p className="mt-1 text-sm text-gray-500">
                        {state === 'recording' ? '録音中です' : 'スマホのマイクで収録できます'}
                    </p>
                </div>
                <div className="flex h-12 min-w-20 items-center justify-center rounded-lg bg-gray-50 px-4 text-xl font-bold text-gray-900">
                    {formatTime(seconds)}
                </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {state !== 'recording' ? (
                    <button
                        onClick={startRecording}
                        className="h-14 rounded-lg bg-red-600 px-5 text-base font-bold text-white hover:bg-red-700"
                    >
                        録音開始
                    </button>
                ) : (
                    <button
                        onClick={stopRecording}
                        className="h-14 rounded-lg bg-gray-900 px-5 text-base font-bold text-white hover:bg-gray-800"
                    >
                        停止
                    </button>
                )}

                <button
                    onClick={resetRecording}
                    disabled={state === 'recording' || state === 'idle'}
                    className="h-14 rounded-lg border border-gray-300 px-5 text-base font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    録り直す
                </button>
            </div>

            {error && (
                <div className="alert-error mt-4 rounded-lg p-3 text-sm">
                    {error}
                </div>
            )}

            {audioUrl && recordedFile && (
                <div className="mt-5 space-y-4">
                    <audio src={audioUrl} controls className="w-full" />
                    <button
                        onClick={() => onFileReady(recordedFile)}
                        className="h-14 w-full rounded-lg bg-teal-600 px-5 text-base font-bold text-white hover:bg-teal-700"
                    >
                        この音声で生成
                    </button>
                </div>
            )}
        </section>
    )
}
