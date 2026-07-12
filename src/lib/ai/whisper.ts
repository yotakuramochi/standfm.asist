import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

// 文字起こし: OpenAI Whisperを優先し、キー未設定・クォータ切れ等の失敗時は
// Gemini(音声入力対応)へ自動フォールバックする

const GEMINI_INLINE_LIMIT = 15 * 1024 * 1024 // inlineDataの実用上限(~20MBリクエスト制限に余裕をみる)

function guessMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase()
    switch (ext) {
        case 'mp3': return 'audio/mpeg'
        case 'm4a': return 'audio/mp4'
        case 'aac': return 'audio/aac'
        case 'wav': return 'audio/wav'
        case 'webm': return 'audio/webm'
        case 'ogg': return 'audio/ogg'
        case 'caf': return 'audio/x-caf'
        default: return 'audio/mpeg'
    }
}

async function transcribeWithWhisper(audioBuffer: ArrayBuffer, fileName: string): Promise<string> {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    })

    const blob = new Blob([audioBuffer])
    const file = new File([blob], fileName, { type: 'audio/mpeg' })

    const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'ja',
        response_format: 'text',
    })

    return transcription
}

async function transcribeWithGemini(audioBuffer: ArrayBuffer, fileName: string): Promise<string> {
    if (!process.env.GOOGLE_AI_API_KEY) {
        throw new Error('文字起こしに使えるAPIキーがありません(OpenAI/Gemini両方とも利用不可)')
    }
    if (audioBuffer.byteLength > GEMINI_INLINE_LIMIT) {
        throw new Error('Gemini文字起こしは15MBまでです。OpenAIキーの復旧をご確認ください。')
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
    const model = genAI.getGenerativeModel({
        model: process.env.GOOGLE_AI_MODEL || 'gemini-2.5-flash',
    })

    const result = await model.generateContent([
        {
            inlineData: {
                mimeType: guessMimeType(fileName),
                data: Buffer.from(audioBuffer).toString('base64'),
            },
        },
        {
            text: '添付の音声を日本語で正確に文字起こししてください。話された内容をそのまま書き起こし、文字起こしテキストのみを出力してください(説明・前置きは不要)。',
        },
    ])

    return result.response.text().trim()
}

export async function transcribeAudio(audioBuffer: ArrayBuffer, fileName: string): Promise<string> {
    if (process.env.OPENAI_API_KEY) {
        try {
            return await transcribeWithWhisper(audioBuffer, fileName)
        } catch (error) {
            console.error('Whisper failed, falling back to Gemini transcription:', error)
        }
    }
    return transcribeWithGemini(audioBuffer, fileName)
}
