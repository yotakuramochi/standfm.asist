import { NextResponse } from 'next/server'
import { transcribeAudio } from '@/lib/ai/whisper'
import { generateContent } from '@/lib/ai/gemini'

// API route for processing audio files
// This handles: upload -> transcription -> generation

export async function POST(request: Request) {
    try {
        const formData = await request.formData()
        const audioFile = formData.get('audio') as File | null
        const tonePreset = formData.get('tone') as string || 'standard'

        if (!audioFile) {
            return NextResponse.json(
                { error: 'No audio file provided' },
                { status: 400 }
            )
        }

        // Validate file size (30MB max)
        if (audioFile.size > 30 * 1024 * 1024) {
            return NextResponse.json(
                { error: 'ファイルサイズは30MB以下にしてください' },
                { status: 400 }
            )
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

今日は「音声配信の魅力」についてお話しします。音声配信は、いつでもどこでも録音できる手軽さが魅力です。

通勤中や家事をしながらでも聴けるので、リスナーさんにとっても便利なコンテンツですね。`,
                    summary: '音声配信の手軽さと、リスナーにとっての利便性について解説。いつでもどこでも録音・視聴できる点が魅力。',
                    titles: [
                        '🎙️ 音声配信の魅力を徹底解説！始め方から継続のコツまで',
                        '📻 なぜ今、音声配信なのか？3つのメリット',
                        '🌟 音声配信で人生が変わった話',
                    ],
                    description: `【今日のテーマ】
音声配信の魅力について

【内容】
・いつでもどこでも録音できる手軽さ
・リスナーさんの「ながら聴き」に最適
・継続しやすいコンテンツ形式

【まとめ】
音声配信は、配信者にもリスナーにも優しいメディア。まずは気軽に始めてみましょう！

#standfm #音声配信 #ポッドキャスト`,
                    xPost: `🎙️ 音声配信の魅力って？

✅ いつでもどこでも録音OK
✅ ながら聴きで効率◎
✅ 続けやすい！

音声は話すだけでコンテンツになる。
これってすごいことだと思うんです。

#standfm #音声配信`,
                },
            })
        }

        // Step 1: Transcribe audio using Whisper
        console.log('Transcribing audio...')
        const audioBuffer = await audioFile.arrayBuffer()
        const rawTranscript = await transcribeAudio(audioBuffer, audioFile.name)

        // Step 2: Generate content using Gemini
        console.log('Generating content...')
        const generated = await generateContent(rawTranscript, tonePreset)

        return NextResponse.json({
            success: true,
            data: {
                transcript: generated.cleanedTranscript,
                summary: generated.summary,
                titles: generated.titles,
                description: generated.standfmDescription,
                xPost: generated.xPost,
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
