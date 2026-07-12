import { NextResponse } from 'next/server'
import { transcribeAudio } from '@/lib/ai/whisper'
import { generateContent } from '@/lib/ai/gemini'
import { postToJournalViaDiscord } from '@/lib/discord'

// API route for processing audio files
// 入力は2系統:
//  - multipart/form-data (4MB以下の直接アップロード)
//  - application/json { blobUrl, fileName } (4MB超: Vercel Blob経由)

export const runtime = 'nodejs'
export const maxDuration = 300

const MAX_DIRECT_AUDIO_SIZE = 4 * 1024 * 1024

interface AudioSource {
    buffer: ArrayBuffer
    fileName: string
    tone: string
}

async function readAudioSource(request: Request): Promise<AudioSource | NextResponse> {
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
        const { blobUrl, fileName, tone } = await request.json()
        if (!blobUrl || typeof blobUrl !== 'string') {
            return NextResponse.json({ error: 'No blobUrl provided' }, { status: 400 })
        }
        // Vercel Blobの公開URL以外は取得しない(SSRF対策)
        if (!/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//.test(blobUrl)) {
            return NextResponse.json({ error: '不正なファイルURLです' }, { status: 400 })
        }
        const blobResponse = await fetch(blobUrl)
        if (!blobResponse.ok) {
            return NextResponse.json({ error: '音声ファイルの取得に失敗しました' }, { status: 400 })
        }
        return {
            buffer: await blobResponse.arrayBuffer(),
            fileName: typeof fileName === 'string' && fileName ? fileName : 'audio.m4a',
            tone: typeof tone === 'string' ? tone : 'standard',
        }
    }

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null
    const tone = (formData.get('tone') as string) || 'standard'

    if (!audioFile) {
        return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }
    if (audioFile.size > MAX_DIRECT_AUDIO_SIZE) {
        return NextResponse.json(
            { error: '4MBを超えるファイルはBlobアップロードを使用してください' },
            { status: 400 }
        )
    }

    return { buffer: await audioFile.arrayBuffer(), fileName: audioFile.name, tone }
}

export async function POST(request: Request) {
    try {
        const source = await readAudioSource(request)
        if (source instanceof NextResponse) {
            return source
        }

        // Check if API keys are configured
        if (!process.env.OPENAI_API_KEY || !process.env.GOOGLE_AI_API_KEY) {
            // Return mock data if API keys not configured
            console.log('API keys not configured, returning mock data')
            return NextResponse.json({
                success: true,
                mock: true,
                data: {
                    transcript: `これはサンプルの文字起こしテキストです。

今日は「音声配信の魅力」についてお話しします。音声配信は、いつでもどこでも録音できる手軽さが魅力です。`,
                    summary: '音声配信の手軽さと、リスナーにとっての利便性について解説。',
                    titles: [
                        '🎙️ 音声配信の魅力を徹底解説!',
                        '📻 なぜ今、音声配信なのか?',
                        '🌟 音声配信で人生が変わった話',
                    ],
                    description: `【今日のテーマ】\n音声配信の魅力について\n\n【まとめ】\nまずは気軽に始めてみましょう!\n\n#standfm #音声配信`,
                    xPost: `🎙️ 音声配信の魅力って?\n\n✅ いつでもどこでも録音OK\n✅ ながら聴きで効率◎\n\nこれが真実です。`,
                    noteArticle: `# サンプルNote記事\n\nAPIキー設定後に本物が生成されます。`,
                    substackLetter: `こんにちは、よーたです。\n\nこれはサンプルレターです。APIキー設定後に本物が生成されます。`,
                    journalSynced: false,
                },
            })
        }

        // Step 1: Transcribe audio using Whisper
        console.log('Transcribing audio...')
        const rawTranscript = await transcribeAudio(source.buffer, source.fileName)

        // Step 2: Generate content using Gemini
        console.log('Generating content...')
        const generated = await generateContent(rawTranscript, source.tone)

        // Step 3: Obsidian日誌へ還流(Discord Webhook→listener_bot)
        // 失敗しても生成結果は返す(非致命)
        const journalSynced = await postToJournalViaDiscord({
            title: generated.titles[0] || '無題',
            summary: generated.summary,
            transcript: generated.cleanedTranscript,
        })

        return NextResponse.json({
            success: true,
            data: {
                transcript: generated.cleanedTranscript,
                summary: generated.summary,
                titles: generated.titles,
                description: generated.standfmDescription,
                xPost: generated.xPost,
                noteArticle: generated.noteArticle,
                substackLetter: generated.substackLetter,
                journalSynced,
            },
        })
    } catch (error) {
        console.error('Processing error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '処理に失敗しました' },
            { status: 500 }
        )
    }
}
