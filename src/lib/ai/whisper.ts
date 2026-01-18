import OpenAI from 'openai'

// Whisper API for transcription
export async function transcribeAudio(audioBuffer: ArrayBuffer, fileName: string): Promise<string> {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    })

    // Convert ArrayBuffer to File-like object
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
